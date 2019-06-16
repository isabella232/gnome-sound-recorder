/* exported Play */
/*
 * Copyright 2013 Meg Ford
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Library General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public
 * License along with this library; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Meg Ford <megford@gnome.org>
 *
 */

const _ = imports.gettext.gettext;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Gst = imports.gi.Gst;
const GstAudio = imports.gi.GstAudio;
const GstPbutils = imports.gi.GstPbutils;

const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;

const Application = imports.application;
const MainWindow = imports.mainWindow;

const utils = imports.utils;

const PipelineStates = {
    PLAYING: 0,
    PAUSED: 1,
    STOPPED: 2,
    NULL: 3
};

const ErrState = {
    OFF: 0,
    ON: 1
}

let errorDialogState;

const _TENTH_SEC = 100000000;

var Player = GObject.registerClass({
    Signals: {
      'time-updated': {
          flags: GObject.SignalFlags.RUN_FIRST,
          param_types: [ GObject.TYPE_INT ]
      },
      'stream-ended': {
          flags: GObject.SignalFlags.RUN_FIRST
      }
    }

  },
  class Player extends GObject.Object {
    _init() {
      super._init();
      this.playState = PipelineStates.STOPPED;
      this.playbin = Gst.ElementFactory.make("playbin", "play");
      this.sink = Gst.ElementFactory.make("pulsesink", "sink");
      this.playbin.set_property("audio-sink", this.sink);
      this.clock = this.playbin.get_clock();
      this.playBus = this.playbin.get_bus();
      this._asset = null;
    }
    _playPipeline() {
        errorDialogState = ErrState.OFF;
        this.playBus.add_signal_watch();
        this.playBus.connect("message", (playBus, message) => {
            if (message != null) {
                this._onMessageReceived(message);
            }
        });
    }

    get duration() {
      return this.playbin.query_duration(Gst.Format.TIME)

    }

    play(recording) {
        this.playbin.set_property("uri", recording.uri);
        this.startPlaying();
    }

    isPlaying() {
      return this.playState == PipelineStates.PLAYING
    }


    startPlaying() {
        this.baseTime = 0;

        if (!this.play || this.playState == PipelineStates.STOPPED ) {
            this._playPipeline();
        }

        if (this.playState == PipelineStates.PAUSED) {
            this.updatePosition();
            this.playbin.set_base_time(this.clock.get_time());
            this.baseTime = this.playbin.get_base_time() - this.runTime;
        }

        this.ret = this.playbin.set_state(Gst.State.PLAYING);
        this.playState = PipelineStates.PLAYING;

        if (this.ret == Gst.StateChangeReturn.FAILURE) {
            this._showErrorDialog(_('Unable to play recording'));
            errorDialogState = ErrState.ON;
        } else if (this.ret == Gst.StateChangeReturn.SUCCESS) {
            /*MainWindow.view.setVolume();*/
        }
    }

    pausePlaying() {
        this.playbin.set_state(Gst.State.PAUSED);
        this.playState = PipelineStates.PAUSED;

        if (this.timeout) {
            GLib.source_remove(this.timeout);
            this.timeout = null;
        }
    }

    resumePlaying () {
        this.playbin.set_state(Gst.State.PLAYING);
        this.playState = PipelineStates.PLAYING;
    }


    stopPlaying() {
        if (this.playState != PipelineStates.STOPPED) {
            this.onEnd();
        }
    }

    onEnd() {
        this.playbin.set_state(Gst.State.NULL);
        this.playState = PipelineStates.STOPPED;
        this.playBus.remove_signal_watch();
        this._updateTime();

        if (this.timeout) {
            GLib.source_remove(this.timeout);
            this.timeout = null;
        }
        this.emit("stream-ended")
    }


    _onMessageReceived(message) {
        this.localMsg = message;
        switch(message.type) {

            case Gst.MessageType.EOS:
                this.emit("stream-ended")
            break;

            case Gst.MessageType.WARNING:
                let warningMessage = message.parse_warning()[0];
                log(warningMessage.toString());
            break;

            case Gst.MessageType.ERROR:
                let errorMessage = message.parse_error()[0];
                this._showErrorDialog(errorMessage.toString());
                errorDialogState = ErrState.ON;
            break;

            case Gst.MessageType.ASYNC_DONE:
                if (this.sought) {
                    this.playbin.set_state(this._lastState);
                    MainWindow.view.setProgressScaleSensitive();
                }
                this.updatePosition();
            break;

            case Gst.MessageType.CLOCK_LOST:
                this.pausePlaying();
            break;

            case Gst.MessageType.NEW_CLOCK:
                if (this.playState == PipelineStates.PAUSED) {
                    this.clock = this.playbin.get_clock();
                    this.startPlaying();
                }
            break;
        }
    }

    getPipeStates() {
        return this.playState;
    }

    _updateTime() {
        let time = this.playbin.query_position(Gst.Format.TIME)[1];
        let trackDuration = this.playbin.query_duration(Gst.Format.TIME)[1];

        this.emit("time-updated", time);

        if(this.wave)
            this.wave._drawEvent(time);



        return true;
    }




    queryPosition() {
        let position = 0;
        while (position == 0) {
            position = this.playbin.query_position(Gst.Format.TIME)[1]/Gst.SECOND;
        }

        return position;
    }

    updatePosition() {
        if (!this.timeout) {
            this.timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10, () =>
                this._updateTime());
        }
    }

    setVolume(value) {
        this.playbin.set_volume(GstAudio.StreamVolumeFormat.CUBIC, value);
    }

    passSelected(selected) {
        this._selected = selected;
        this._fileToPlay = MainWindow.view.loadPlay(this._selected);
    }

    _showErrorDialog(errorStrOne, errorStrTwo) {
        if (errorDialogState == ErrState.OFF) {
            let errorDialog = new Gtk.MessageDialog ({ destroy_with_parent: true,
                                                       buttons: Gtk.ButtonsType.OK,
                                                       message_type: Gtk.MessageType.WARNING });

            if (errorStrOne != null)
                errorDialog.set_property('text', errorStrOne);

            if (errorStrTwo != null)
                errorDialog.set_property('secondary-text', errorStrTwo);

            errorDialog.set_transient_for(Gio.Application.get_default().get_active_window());
            errorDialog.connect ('response', () => {
                errorDialog.destroy();
                this.onEndOfStream();
            });
            errorDialog.show();
        }
    }
  }
);


var PlayerWidget = GObject.registerClass({
    Template: 'resource:///org/gnome/SoundRecorder/player.ui',
    Signals: {
      'pause': {
          flags: GObject.SignalFlags.RUN_FIRST
      },
      'play': {
          flags: GObject.SignalFlags.RUN_FIRST
      }
    },
    InternalChildren: [
      'clip_name_label',
      'clip_duration_label',
      'player_scale',
      'player_adjustement',
      'pause_button',
      'play_button',
      'pause_stack'
    ],
  },
  class PlayerWidget extends Gtk.Box {
    _init() {
      super._init();


      this._pause_button.connect('clicked', () => {
        this._pause_stack.set_visible_child_name('play');
        this.emit('pause');
      });

      this._play_button.connect('clicked', () => {
        this._pause_stack.set_visible_child_name('pause');
        this.emit('play');
      });

      this.show_all();
    }

    setPlaying(recording) {
      this._player_adjustement.set_upper(recording.duration);
      this._player_adjustement.set_value(0);
      this._clip_name_label.set_text(recording.fileName);
      this._pause_stack.set_visible_child_name('pause');
    }

    updateTime(time) {
      log(time);
      this._clip_duration_label.set_text(utils.getDisplayDuration(time));
      this._player_adjustement.set_value(time);
    }

    reset() {
      this._player_adjustement.set_value(this._player_adjustement.upper);
      this._pause_stack.set_visible_child_name('play');
    }

  }
);
