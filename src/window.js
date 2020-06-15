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
const { GObject, Handy } = imports.gi;

const { Player } = imports.player;
const { Recorder } = imports.recorder;
const { RecordingList } = imports.recordingList;
const { Row, RowState } = imports.row;
const { formatTime } = imports.utils;
const { WaveForm } = imports.waveform;


var Window = GObject.registerClass({
    Template: 'resource:///org/gnome/SoundRecorder/ui/window.ui',
    InternalChildren: ['recorderTime', 'mainStack', 'recorderBox', 'listBox', 'emptyIcon', 'playbackStack', 'headerRevealer'],
}, class Window extends Handy.ApplicationWindow {

    _init(params) {
        super._init(Object.assign({
            icon_name: pkg.name,
        }, params));

        this.recorder = new Recorder();
        this.player = new Player();
        this.waveform = new WaveForm();
        this._recorderBox.add(this.waveform);

        this.recorder.connect('waveform', (_, time, peak) => {
            this.waveform.drawAt(time, peak);
        });

        this.recorder.connect('notify::duration', _recorder => {
            this._recorderTime.label = formatTime(_recorder.duration);
        });

        this.connect('destroy', () => {
            this.waveform.destroy();
            this.player.stop();
            this.recorder.stop();
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

    onRecorderPause() {
        this.recorder.pause();
        this._playbackStack.visible_child_name = 'recorder-start';
    }

    onRecorderResume() {
        this.recorder.resume();
        this._playbackStack.visible_child_name = 'recorder-pause';
    }

    onRecorderStart() {
        this.player.stop();

        this._headerRevealer.reveal_child = false;
        this._mainStack.visible_child_name = 'recorder';
        this._playbackStack.visible_child_name = 'recorder-pause';

        this.recorder.start();
    }

    onRecorderCancel() {
        const recording = this.recorder.stop();
        recording.delete();
        this._setMainView();
    }

    onRecorderStop() {
        const recording = this.recorder.stop();
        this._recordingList.insert(0, recording);
        this._setMainView();
    }

    _setMainView() {
        this.waveform.destroy();
        this._playbackStack.visible_child_name = 'recorder-start';
        this._mainStack.visible_child_name = 'recordings';
        this._headerRevealer.reveal_child = true;
    }

    _refreshView() {
        if (this._recordingList.get_n_items() === 0)
            this._mainStack.visible_child_name = 'empty';
        else
            this._mainStack.visible_child_name = 'recordings';
    }
});
