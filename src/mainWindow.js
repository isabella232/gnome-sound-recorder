/* exported MainWindow */
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
const { GObject, Gst, Handy } = imports.gi;

const { Player } = imports.player;
const { Recorder } = imports.recorder;
const { RecordingList } = imports.recordingList;
const { Row, RowState } = imports.row;
const Utils = imports.utils;
const { WaveForm } = imports.waveform;


var MainWindow = GObject.registerClass({
    Template: 'resource:///org/gnome/SoundRecorder/ui/window.ui',
    InternalChildren: ['recordTimeLabel', 'mainStack', 'recordGrid', 'listBox', 'emptyIcon', 'playbackStack', 'headerRevealer'],
}, class MainWindow extends Handy.ApplicationWindow {

    _init(params) {
        super._init(Object.assign({
            icon_name: pkg.name,
        }, params));

        this._recorder = new Recorder();
        this.player = new Player();
        this.waveform = new WaveForm();
        this._recordGrid.add(this.waveform);

        this._recorder.connect('waveform', (_, time, peak) => {
            this.waveform._drawEvent(time, peak);
        });

        this._recorder.connect('notify::duration', _recorder => {
            this._recordTimeLabel.label = Utils.Time.formatTime(_recorder.duration);
        });

        this.connect('destroy', () => {
            this.waveform.endDrawing();
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

    onRecorderPause() {
        this._recorder.state = Gst.State.PAUSED;
        this._playbackStack.set_visible_child_name('recorder-start');
    }

    onRecorderResume() {
        this._recorder.state = Gst.State.PLAYING;
        this._playbackStack.set_visible_child_name('recorder-pause');
    }

    onRecorderStart() {
        this.player.stop();
        this._mainStack.set_visible_child_name('recorderView');
        this._recorder.start();
        this._headerRevealer.reveal_child = false;

        this._playbackStack.set_visible_child_name('recorder-pause');
    }

    onRecorderStop() {
        const recording = this._recorder.stop();
        this._recordingList.insert(0, recording);
        this._headerRevealer.reveal_child = true;

        this.waveform.endDrawing();
        this._playbackStack.set_visible_child_name('recorder-start');
    }

    _refreshView() {
        if (this._recordingList.get_n_items() === 0)
            this._mainStack.set_visible_child_name('emptyView');
        else
            this._mainStack.set_visible_child_name('mainView');
    }
});
