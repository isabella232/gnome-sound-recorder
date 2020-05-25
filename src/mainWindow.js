/* exported audioProfile displayTime list offsetController
            play recordPipeline view volumeValue wave ActiveArea
            RecordPipelineStates _SEC_TIMEOUT MainWindow
            EncoderComboBox ChannelsComboBox */
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
const Record = imports.record;
const Waveform = imports.waveform;

var displayTime = null;
var player = null;
var recordPipeline = null;
var view = null;
var wave = null;

var ActiveArea = {
    RECORD: 0,
    PLAY: 1,
};

var MainWindow = GObject.registerClass({
    Template: 'resource:///org/gnome/SoundRecorder/ui/window.ui',
    InternalChildren: ['recordStartButton', 'recordStopButton', 'recordTimeLabel', 'appMenuButton', 'mainStack', 'recordGrid', 'listBox'],
}, class MainWindow extends Handy.ApplicationWindow {

    _init(params) {
        super._init(Object.assign({
            icon_name: pkg.name,
        }, params));

        this._record = new Record.Record();
        player = new Player();
        view = this;

        this.connect('destroy', () => player.stop());

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
                player.play(recording.uri);
            });

            row.connect('pause', () => player.pause());
            row.connect('deleted', () => this._recordingList.remove(row.get_index()));

            return row;
        });

        this._recordStartButton.connect('clicked', () => this._onRecordStart());
        this._recordStopButton.connect('clicked', () => this._onRecordStop());
        this._addAppMenu();
        this.show();
    }

    _addAppMenu() {
        let menu = new Gio.Menu();
        menu.append(_('Preferences'), 'app.preferences');
        menu.append(_('About Sound Recorder'), 'app.about');
        this._appMenuButton.set_menu_model(menu);
    }

    _onRecordStart() {
        player.stop();
        this._mainStack.set_visible_child_name('mainView');
        this._recordGrid.show();
        this._record.startRecording();

        wave = new Waveform.WaveForm(this._recordGrid, null);
    }

    _onRecordStop() {
        Record.pipeState = Record.PipelineStates.STOPPED;
        this._record.stopRecording();
        this._recordGrid.hide();

        let fileUri = this._record.initialFileName;
        let recordedFile = Gio.file_new_for_path(fileUri);
        let recording = new Recording(recordedFile);
        this._recordingList.insert(0, recording);

        wave = null;
    }

    _refreshView() {
        if (this._recordingList.get_n_items() === 0)
            this._mainStack.set_visible_child_name('emptyView');
        else
            this._mainStack.set_visible_child_name('mainView');
    }

    setRecordTimeLabel(time) {
        let timeLabelString = Utils.Time.formatTime(time);
        this._recordTimeLabel.label = timeLabelString;
    }
});
