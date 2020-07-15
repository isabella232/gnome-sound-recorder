/* exported Player */
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
const { Gio, GObject, Gst, Gtk, GLib } = imports.gi;

var Player = new GObject.registerClass({
    Properties: {
        'duration': GObject.ParamSpec.int(
            'duration',
            'Recording Duration', 'Recording duration in seconds',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
            0, GLib.MAXINT16, 0),
        'position': GObject.ParamSpec.int(
            'position',
            'Player playback position', 'Recording playback position',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
            0, GLib.MAXINT16, 0),
        'state': GObject.ParamSpec.enum(
            'state',
            'Player playback state', 'Recording playback state',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
            Gst.State,
            Gst.State.NULL),
    },
}, class Player extends GObject.Object {
    _init() {
        this.player = Gst.ElementFactory.make('playbin', 'play');
        let sink = Gst.ElementFactory.make('pulsesink', 'sink');
        this.player.set_property('audio-sink', sink);
        super._init({});

        this.playerBus = this.player.get_bus();
        this.playerBus.connect('message', (playerBus, message) => {
            if (message !== null)
                this._onMessageReceived(message);
        });
    }

    play(uri) {
        this.stop();
        this.playerBus.add_signal_watch();
        this.player.set_property('uri', uri);
        this.state = Gst.State.PLAYING;
    }

    pause() {
        this.state = Gst.State.PAUSED;
    }

    stop() {
        this.state = Gst.State.NULL;
        this.playerBus.remove_watch();
    }

    _onMessageReceived(message) {
        switch (message.type) {
        case Gst.MessageType.EOS:
            this.stop();
            break;
        case Gst.MessageType.WARNING:
            log(message.parse_warning()[0].toString());
            break;
        case Gst.MessageType.ERROR:
            this.stop();
            this._showErrorDialog(message.parse_error()[0].toString());
            break;
        }
    }

    _showErrorDialog(errorMessage) {
        let errorDialog = new Gtk.MessageDialog({ destroy_with_parent: true,
            buttons: Gtk.ButtonsType.OK,
            message_type: Gtk.MessageType.WARNING,
            text: errorMessage,
            transient_for: Gio.Application.get_default().get_active_window() });

        errorDialog.connect('response', () => errorDialog.destroy());
        errorDialog.show();
    }

    get duration() {
        const duration = this.player.query_duration(Gst.Format.TIME)[1];
        return duration >= 0 ? duration : 0;
    }

    set position(value) {
        this._position = value >= 0 ? value : 0;
        this.player.seek_simple(Gst.Format.TIME, Gst.SeekFlags.FLUSH, this._position);
        this.notify('position');
    }

    get position() {
        return this.player.query_position(Gst.Format.TIME)[1];
    }

    set state(value) {
        this._state = value;
        this.player.set_state(value);
        this.notify('state');
    }

    get state() {
        return this._state;
    }
});
