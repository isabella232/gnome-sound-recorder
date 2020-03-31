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
const Gtk = imports.gi.Gtk;

const Settings = imports.preferences.settings;
const AudioProfile = imports.audioProfile;
const Utils = imports.utils;
const Listview = imports.listview;
const Row = imports.row.Row;
const RowState = imports.row.RowState;
const Player = imports.player.Player;
const Record = imports.record;
const Waveform = imports.waveform;

let activeProfile = null;
var audioProfile = null;
var displayTime = null;
var list = null;
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
    InternalChildren: ['recordButton', 'appMenuButton', 'mainStack', 'mainView', 'emptyView'],
}, class MainWindow extends Gtk.ApplicationWindow {

    _init(params) {
        audioProfile = new AudioProfile.AudioProfile();
        displayTime = new Utils.DisplayTime();
        view = this;
        this._addListviewPage();
        player = new Player();

        super._init(Object.assign({
            icon_name: pkg.name,
        }, params));

        this._recordButton.connect('clicked', () => this._onRecord());
        this._addAppMenu();
        this.show_all();
    }

    _addAppMenu() {
        let menu = new Gio.Menu();
        menu.append(_('Preferences'), 'app.preferences');
        menu.append(_('About Sound Recorder'), 'app.about');
        this._appMenuButton.set_menu_model(menu);
    }

    _onRecord() {
        if (view.listBox)
            view.listBox.set_selection_mode(Gtk.SelectionMode.NONE);
        else
            this._mainStack.set_visible_child(this._mainView);

        this._recordButton.set_sensitive(false);
        view.recordGrid.show_all();

        if (activeProfile === null)
            activeProfile = 0;

        audioProfile.profile(activeProfile);
        view._record.startRecording(activeProfile);
        wave = new Waveform.WaveForm(view.recordGrid, null);
    }

    _addListviewPage() {
        list = new Listview.Listview();
        list.setListTypeNew();
        list.enumerateDirectory();
        this._record = new Record.Record(audioProfile);
    }

    onRecordStopClicked() {
        Record.pipeState = Record.PipelineStates.STOPPED;
        this._record.stopRecording();
        this.recordGrid.hide();
        this._recordButton.set_sensitive(true);
        wave = null;
    }

    _updatePositionCallback() {
        let position = player.queryPosition();

        if (position >= 0)
            this.progressScale.set_value(position);

        return true;
    }

    listBoxAdd() {
        activeProfile = Settings.mediaCodec;

        this.recordGrid = new Gtk.Grid({ name: 'recordGrid',
            orientation: Gtk.Orientation.HORIZONTAL });
        this._mainView.add(this.recordGrid);

        this.widgetRecord = new Gtk.Toolbar({ show_arrow: false,
            halign: Gtk.Align.END,
            valign: Gtk.Align.FILL,
            icon_size: Gtk.IconSize.BUTTON,
            opacity: 1 });
        this.recordGrid.attach(this.widgetRecord, 0, 0, 2, 2);

        this._boxRecord = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL });
        this._groupRecord = new Gtk.ToolItem({ child: this._boxRecord });
        this.widgetRecord.insert(this._groupRecord, -1);

        this.recordTextLabel = new Gtk.Label({ margin_bottom: 4,
            margin_end: 6,
            margin_start: 6,
            margin_top: 6 });
        this.recordTextLabel.label = _('Recording…');
        this._boxRecord.pack_start(this.recordTextLabel, false, true, 0);

        this.recordTimeLabel = new Gtk.Label({ margin_bottom: 4,
            margin_end: 6,
            margin_start: 6,
            margin_top: 6 });

        this._boxRecord.pack_start(this.recordTimeLabel, false, true, 0);

        this.toolbarStart = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, expand: false });
        this.toolbarStart.get_style_context().add_class(Gtk.STYLE_CLASS_LINKED);

        // finish button (stop recording)
        let stopRecord = new Gtk.Button({ label: _('Done'),
            halign: Gtk.Align.FILL,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            margin_bottom: 4,
            margin_end: 6,
            margin_start: 6,
            margin_top: 6 });
        stopRecord.get_style_context().add_class('text-button');
        stopRecord.connect('clicked', () => this.onRecordStopClicked());
        this.toolbarStart.pack_start(stopRecord, true, true, 0);
        this.recordGrid.attach(this.toolbarStart, 5, 1, 2, 2);
    }

    scrolledWinAdd() {
        this._scrolledWin = new Gtk.ScrolledWindow({ vexpand: true });
        this._scrolledWin.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.scrollbar = this._scrolledWin.get_vadjustment();

        this._mainView.add(this._scrolledWin);
        this._scrolledWin.show();

        this.listBox = null;

        if (list.getItemCount() === 0) {
            this._scrolledWin.get_style_context().add_class('emptyGrid');
            this._mainStack.set_visible_child(this._emptyView);
        } else {
            this.listBox = new Gtk.ListBox({ vexpand: true });
            this._scrolledWin.add(this.listBox);
            this.listBox.set_selection_mode(Gtk.SelectionMode.SINGLE);
            this.listBox.set_header_func(null);
            this.listBox.set_activate_on_single_click(true);
            this.listBox.show();

            this._files = [];
            this._files = list.getFilesInfoForList();

            this._files.forEach(file => {
                let row = new Row(file);
                row.connect('play', (playingRow, fileUri) => {
                    this.listBox.get_children().forEach(_row => {
                        if (_row !== playingRow)
                            _row.setState(RowState.PAUSED);
                    });
                    player.startPlaying(fileUri);
                });
                row.connect('pause', () => player.pausePlaying());
                this.listBox.add(row);
            });
        }
        list.monitorListview();
    }

    listBoxRefresh() {
        list.setListTypeRefresh();
        list.enumerateDirectory();
    }

    scrolledWinDelete() {
        this._scrolledWin.destroy();
        this.scrolledWinAdd();
    }

    setRecordTimeLabel(time) {
        this.timeLabelString = Utils.StringUtils.formatTime(time);
        this.recordTimeLabel.label = this.timeLabelString;
        this.recordTimeLabel.get_style_context().add_class('dim-label');
    }
});
