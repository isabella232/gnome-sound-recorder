/* exported Record */
/*
 * Copyright 2019 Bilal Elmoussaoui
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
 *  Author: Bilal Elmoussaoui <bilal.elmoussaoui@gnome.org>
 *
 */
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;

const Gst = imports.gi.Gst;
const GstPbutils = imports.gi.GstPbutils;
const Player = imports.player.Player;
const utils = imports.utils;

const WaveForm = imports.waveform.WaveForm;

var Recording = GObject.registerClass({},
  class Recording extends GObject.Object {

    _init(file) {
      super._init();
      this._file = file;

      this.fileName = null;
      this.uri = null;
      this.dateCreated = null;
      this.duration = 0;

      this._parseInfo();
      this.wave = new WaveForm(this);
    }

    get file() {
      return this._file;
    }

    _parseInfo() {
        let returnedName = this._file.get_attribute_as_string("standard::display-name");

        let filePath = GLib.build_filenamev([Gio.Application.get_default().saveDir.get_path(),
                                             returnedName]);
        this.uri = GLib.filename_to_uri(filePath, null);

        if (this._file.has_attribute("time::created")) {
            let dateCreatedVal = this._file.get_attribute_uint64("time::created");
            this.dateCreated = GLib.DateTime.new_from_timeval_local(dateCreatedVal);
        } else {
          let modificationTime = this._file.get_modification_time();
          this.dateCreated = GLib.DateTime.new_from_timeval_local(modificationTime);
        }
        this.fileName = returnedName;

        let discoverer = new GstPbutils.Discoverer();
        discoverer.start();
        discoverer.discover_uri_async(this.uri);
        discoverer.connect('discovered', (_discoverer, info, error) => {
            let result = info.get_result();
            log(result);
            this._onDiscovererFinished(result, info, error);
        });
    }

    _onDiscovererFinished(res, info, err) {

        if (res == GstPbutils.DiscovererResult.OK) {

            this.tagInfo = info.get_tags();

            let dateTimeTag = this.tagInfo.get_date_time('datetime')[1];
            let durationInfo = info.get_duration();
            this.duration = durationInfo;

            /* this.file.dateCreated will usually be null since time::created it doesn't usually exist.
               Therefore, we prefer to set it with tags */
            if (dateTimeTag != null) {
                this.dateCreated =  dateTimeTag.to_g_date_time();;
            }
            /* FIX ME
            this._getCapsForList(info);
            */
        } else {
            // don't index files we can't play

            log("File cannot be played");
        }

    }

  }
);


var RecordingRow = GObject.registerClass({
  Template: 'resource:///org/gnome/SoundRecorder/recording_row.ui',
  InternalChildren: [
    'clip_label',
    'created_label',
    'time_label',
    'play_button',
    'pause_button',
    'overlay',
    'buttons_stack'
  ],
  Signals: {
  }
  },
  class RecordingRow extends Gtk.ListBoxRow {
    _init(recording) {
      super._init();

      this._player = new Player();
      this.recording = recording;
      this._clip_label.set_text(recording.fileName);
      this._created_label.set_text(utils.getDisplayTime(recording.dateCreated));

      this._overlay.add_overlay(recording.wave);

      this._player.setUri(recording.uri);

      this._play_button.connect('clicked', () => {
        this._player.startPlaying();
        this._buttons_stack.set_visible_child_name("pause");
      });

      this._pause_button.connect('clicked', () => {
        this._player.pausePlaying();
        this._buttons_stack.set_visible_child_name("play");
      });

      this._player.connect("timer-updated", (obj, seconds)=> {

        this._time_label.set_text(utils.getDisplayDuration(seconds));
      })

      this.show_all();
    }
  }
);


var NewRecording = GObject.registerClass({
  Template: 'resource:///org/gnome/SoundRecorder/recording_waveform_row.ui',
  InternalChildren: [
    'overlay',
    'record_time_label'
  ],
  Signals: {
      'paused': {
        flags: GObject.SignalFlags.RUN_FIRST
      },
      'resumed': {
        flags: GObject.SignalFlags.RUN_FIRST
      }
  },
  }, class NewRecording extends Gtk.Box {

    _init() {
      super._init();


      this._state = 0;

      this.show_all();
    }

    updateRecordTime(seconds) {
      this._record_time_label.set_text(utils.getDisplayDuration(seconds));
    }

    setWave(wave) {
        this._overlay.add_overlay(wave);
    }

    reset() {
        this._overlay.remove(this._overlay.get_children()[0])
        this.updateRecordTime(0);

    }


  }
);


