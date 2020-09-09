/* exported Window */
/*
* Copyright 2013 Meg Ford
* This library is free software; you can redistribute it and/or
* modify it under the terms of the GNU Library General Public
* License as published by the Free Software Foundation; either
* version 2 of the License, or (at your option) any later version.
*
* This library is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
* Library General Public License for more details.
*
* You should have received a copy of the GNU Library General Public
* License along with this library; if not, see <http://www.gnu.org/licenses/>.
*
* Author: Meg Ford <megford@gnome.org>
*
*/

const { Gio, GLib, GObject, GstPlayer, Gtk, Handy } = imports.gi;

const { Recorder } = imports.recorder;
const { RecordingList } = imports.recordingList;
const { RecordingsListBox } = imports.recordingsListBox;
const { formatTime } = imports.utils;
const { WaveForm, WaveType } = imports.waveform;
const { RecorderWidget } = imports.recorderWidget;

var WindowState = {
    EMPTY: 0,
    LIST: 1,
    RECORDER: 2,
};

var Window = GObject.registerClass({
    Template: 'resource:///org/gnome/SoundRecorder/ui/window.ui',
    InternalChildren: [
        'mainStack', 'emptyIcon', 'column', 'headerRevealer',
        'notificationRevealer', 'notificationMessage',
        'notificationUndoBtn', 'notificationCloseBtn',
    ],
}, class Window extends Handy.ApplicationWindow {

    _init(params) {
        super._init(Object.assign({
            icon_name: pkg.name,
        }, params));

        this.recorder = new Recorder();
        this.recorderWidget = new RecorderWidget(this.recorder);
        this._mainStack.add_named(this.recorderWidget, "recorder");

        const dispatcher = GstPlayer.PlayerGMainContextSignalDispatcher.new(null);
        this.player = GstPlayer.Player.new(null, dispatcher);
        this.player.connect('end-of-stream', _p => this.player.stop());


        this.connect('destroy', () => {
            this.player.stop();
            this.recorder.stop();
        });

        this._recordingList = new RecordingList();
        this._recordingList.connect('items-changed', _ => {
            if (this.state !== WindowState.RECORDER) {
                if (this._recordingList.get_n_items() === 0)
                    this.state = WindowState.EMPTY;
                else
                    this.state = WindowState.LIST;
            }
        });

        this._recordingListBox = new RecordingsListBox(this._recordingList, this.player);

        this._recordingListBox.connect('row-deleted', (_listBox, recording, index) => {
            this._recordingList.remove(index);
            this.notify(_('"%s" deleted').format(recording.name),
                _ => recording.delete(),
                _ => this._recordingList.insert(index, recording),
            );
        });

        this._notificationCloseBtn.connect('clicked', _ => {
            this._notificationRevealer.reveal_child = false;
            if (this.deleteSignalId && this.deleteSignalId > 0) {
                GLib.source_remove(this.deleteSignalId);
                this.deleteSignalId = 0;
            }
            this._notificationUndoBtn.disconnect(this.cancelSignalId);
        });
        this._column.add(this._recordingListBox);

        this.recorderWidget.connect('started', this.onRecorderStarted.bind(this));
        this.recorderWidget.connect('canceled', this.onRecorderCanceled.bind(this));
        this.recorderWidget.connect('stopped', this.onRecorderStopped.bind(this));
        this.insert_action_group('recorder', this.recorderWidget.actionsGroup);
        this._emptyIcon.icon_name = `${pkg.name}-symbolic`;
        this.show();
    }

    onRecorderStarted() {
        this.player.stop();

        const activeRow = this._recordingListBox.activeRow;
        if (activeRow && activeRow.editMode)
            activeRow.editMode = false;

        this.state = WindowState.RECORDER;
    }

    onRecorderCanceled() {
        if (this._recordingList.get_n_items() === 0)
            this.state = WindowState.EMPTY;
        else
            this.state = WindowState.LIST;
    }

    onRecorderStopped(widget, recording) {

        this._recordingList.insert(0, recording);
        this._recordingListBox.get_row_at_index(0).editMode = true;
        this.state = WindowState.LIST;
    }

    notify(message, callback, cancelCallback) {
        this._notificationMessage.label = message;
        this._notificationMessage.tooltip_text = message;
        this._notificationRevealer.reveal_child = true;
        this.deleteSignalId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
            callback();
            this._notificationRevealer.reveal_child = false;
            if (this.cancelSignalId && this.cancelSignalId > 0) {
                this._notificationUndoBtn.disconnect(this.cancelSignalId);
                this.cancelSignalId = -1;
            }
        });

        this.cancelSignalId = this._notificationUndoBtn.connect('clicked', _ => {
            cancelCallback();
            this._notificationRevealer.reveal_child = false;
            if (this.deleteSignalId && this.deleteSignalId > 0) {
                GLib.source_remove(this.deleteSignalId);
                this.deleteSignalId = 0;
            }
            this._notificationUndoBtn.disconnect(this.cancelSignalId);
        });
    }

    set state(state) {
        let visibleChild;
        let isHeaderVisible;

        switch (state) {
        case WindowState.RECORDER:
            visibleChild = 'recorder';
            isHeaderVisible = false;
            break;
        case WindowState.LIST:
            visibleChild = 'recordings';
            isHeaderVisible = true;
            break;
        case WindowState.EMPTY:
            visibleChild = 'empty';
            isHeaderVisible = true;
            break;
        }

        this._mainStack.visible_child_name = visibleChild;
        this._headerRevealer.reveal_child = isHeaderVisible;
        this._state = state;
    }

    get state() {
        return this._state;
    }
});
