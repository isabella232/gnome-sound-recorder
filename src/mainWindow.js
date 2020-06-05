/* exported MainWindow view */
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

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Handy = imports.gi.Handy;

const Utils = imports.utils;
const RecordingList = imports.recordingList.RecordingList;
const Recording = imports.recording.Recording;
const Row = imports.row.Row;
const RowState = imports.row.RowState;
const Player = imports.player.Player;
const Recorder = imports.recorder.Recorder;
const Waveform = imports.waveform;

var view = null;

var MainWindow = GObject.registerClass({
    Template: 'resource:///org/gnome/SoundRecorder/ui/window.ui',
    InternalChildren: ['recordTimeLabel', 'mainStack', 'recordGrid', 'listBox', 'emptyIcon'],
}, class MainWindow extends Handy.ApplicationWindow {

    _init(params) {
        super._init(Object.assign({
            icon_name: pkg.name,
        }, params));

        this._recorder = new Recorder();
        this.player = new Player();
        view = this;

        this._recorder.connect('waveform', (_, time, peak) => {
            if (this.wave)
                this.wave._drawEvent(time, peak);
        });

        this._recorder.connect('notify::duration', _recorder => {
            this._recordTimeLabel.label = Utils.Time.formatTime(_recorder.duration);
        });

        this.connect('destroy', () => {
            if (this.wave)
                this.wave.endDrawing();
            this.player.stop();
            this._recorder.stop();
        });

        this._recordingList = new RecordingList();
        this._refreshView();
        this._recordingList.connect('items-changed', this._refreshView.bind(this));

        this._listBox.bind_model(this._recordingList, recording => {
            let row = new Row(recording);
            row.connect('play', currentRow => {
                this._listBox.get_children().forEach(_row => {
                    if (_row !== currentRow)
                        _row.setState(RowState.PAUSED);
                });
                this.player.play(recording.uri);
            });

            row.connect('pause', () => this.player.pause());
            row.connect('deleted', () => this._recordingList.remove(row.get_index()));

            return row;
        });

        this._emptyIcon.icon_name = `${pkg.name}-symbolic`;
        this.show();
    }

    onRecordStart() {
        this.player.stop();
        this._mainStack.set_visible_child_name('recorderView');
        this._recorder.start();

        this.wave = new Waveform.WaveForm(this._recordGrid, null);
    }

    onRecordStop() {
        this._recorder.stop();

        let fileUri = this._recorder.initialFileName;
        let recordedFile = Gio.file_new_for_path(fileUri);
        let recording = new Recording(recordedFile);
        this._recordingList.insert(0, recording);

        this.wave.endDrawing();
        this.wave = null;
    }

    _refreshView() {
        if (this._recordingList.get_n_items() === 0)
            this._mainStack.set_visible_child_name('emptyView');
        else
            this._mainStack.set_visible_child_name('mainView');
    }
});
