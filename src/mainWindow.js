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
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gst = imports.gi.Gst;
const Gtk = imports.gi.Gtk;
const Pango = imports.gi.Pango;

const Settings = imports.preferences.settings;
const AudioProfile = imports.audioProfile;
const FileUtil = imports.fileUtil;
const Info = imports.info;
const Listview = imports.listview;
const Play = imports.play;
const Record = imports.record;
const Waveform = imports.waveform;

let activeProfile = null;
var audioProfile = null;
var displayTime = null;
var list = null;
var play = null;
let previousSelRow = null;
var recordPipeline = null;
let setVisibleID = null;
var view = null;
var volumeValue = [];
var wave = null;

var ActiveArea = {
    RECORD: 0,
    PLAY: 1,
};

const PipelineStates = {
    PLAYING: 0,
    PAUSED: 1,
    STOPPED: 2,
};

var RecordPipelineStates = {
    PLAYING: 0,
    PAUSED: 1,
    STOPPED: 2,
};

const _TIME_DIVISOR = 60;
var _SEC_TIMEOUT = 100;

var MainWindow = GObject.registerClass({
    Template: 'resource:///org/gnome/SoundRecorder/ui/window.ui',
    InternalChildren: ['recordButton', 'appMenuButton', 'mainStack', 'mainView', 'emptyView'],
}, class MainWindow extends Gtk.ApplicationWindow {

    _init(params) {
        audioProfile = new AudioProfile.AudioProfile();
        displayTime = new FileUtil.DisplayTime();
        view = this;
        this._addListviewPage();
        this.labelID = null;
        play = new Play.Play();

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
        view.hasPreviousSelRow();

        if (view.listBox)
            view.listBox.set_selection_mode(Gtk.SelectionMode.NONE);
        else
            this._mainStack.set_visible_child(this._mainView);

        this._recordButton.set_sensitive(false);
        setVisibleID = ActiveArea.RECORD;
        view.recordGrid.show_all();

        if (activeProfile === null)
            activeProfile = 0;

        audioProfile.profile(activeProfile);
        view._record.startRecording(activeProfile);
        wave = new Waveform.WaveForm(view.recordGrid, null);
    }

    _addEmptyPage() {
        this._mainStack.set_visible_child(this._emptyView);
    }

    _addListviewPage() {
        list = new Listview.Listview();
        list.setListTypeNew();
        list.enumerateDirectory();
        this._record = new Record.Record(audioProfile);
    }

    onPlayStopClicked() {
        if (play.getPipeStates() === PipelineStates.PLAYING) {
            play.stopPlaying();
            let listRow = this.listBox.get_selected_row();
            let rowGrid = listRow.get_child();
            rowGrid.foreach(child => {
                if (child.name === 'PauseButton') {
                    child.hide();
                    child.sensitive = false;
                } else if (child.name === 'PlayLabelBox') {
                    child.show();
                    child.foreach(grandchild => {
                        if (grandchild.name === 'PlayTimeLabel')
                            grandchild.hide();


                        if (grandchild.name === 'DividerLabel')
                            grandchild.hide();

                    });
                } else {
                    child.show();
                    child.sensitive = true;
                }
            });
        }
    }

    onRecordStopClicked() {
        this._record.stopRecording();
        this.recordGrid.hide();
        recordPipeline = RecordPipelineStates.STOPPED;
        this._recordButton.set_sensitive(true);
        if (this.listBox !== null)
            this.listBox.set_selection_mode(Gtk.SelectionMode.SINGLE);
    }

    _formatTime(unformattedTime) {
        this.unformattedTime = unformattedTime;
        let seconds = Math.floor(this.unformattedTime);
        let hours = parseInt(seconds / Math.pow(_TIME_DIVISOR, 2));
        let hoursString = '';

        if (hours > 10)
            hoursString = `${hours}:`;
        else if (hours < 10 && hours > 0)
            hoursString = `0${hours}:`;

        let minuteString = parseInt(seconds / _TIME_DIVISOR) % _TIME_DIVISOR;
        let secondString = parseInt(seconds % _TIME_DIVISOR);
        let timeString =
            `${hoursString +
            (minuteString < 10 ? `0${minuteString}` : minuteString)
            }:${
                secondString < 10 ? `0${secondString}` : secondString}`;

        return timeString;
    }

    _updatePositionCallback() {
        let position = MainWindow.play.queryPosition();

        if (position >= 0)
            this.progressScale.set_value(position);

        return true;
    }

    setVolume() {
        if (setVisibleID === ActiveArea.PLAY)
            play.setVolume(volumeValue[0].play);
        else if (setVisibleID === ActiveArea.RECORD)
            this._record.setVolume(volumeValue[0].record);

    }

    getVolume() {
        return this.playVolume.get_value();
    }

    listBoxAdd() {
        let playVolume = Settings.speakerVolume;
        let micVolume = Settings.micVolume;
        volumeValue.push({ record: micVolume, play: playVolume });
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
            this._addEmptyPage();
        } else {
            this.listBox = new Gtk.ListBox({ vexpand: true });
            this._scrolledWin.add(this.listBox);
            this.listBox.set_selection_mode(Gtk.SelectionMode.SINGLE);
            this.listBox.set_header_func(null);
            this.listBox.set_activate_on_single_click(true);
            this.listBox.connect('row-selected', () => {
                this.rowGridCallback();
            });
            this.listBox.show();

            this._files = [];
            this._files = list.getFilesInfoForList();

            this._files.forEach((file, index) => {

                this.rowGrid = new Gtk.Grid({ name: index.toString(),
                    height_request: 45,
                    orientation: Gtk.Orientation.VERTICAL,
                    hexpand: true,
                    vexpand: true });
                this.rowGrid.set_orientation(Gtk.Orientation.HORIZONTAL);
                this.listBox.add(this.rowGrid);
                this.rowGrid.show();

                // play button
                this.playImage = new Gtk.Image({ name: 'PlayImage' });
                this.playImage.set_from_icon_name('media-playback-start-symbolic', Gtk.IconSize.BUTTON);
                this._playListButton = new Gtk.Button({ name: 'PlayButton',
                    hexpand: false,
                    vexpand: true });
                this._playListButton.set_image(this.playImage);
                this._playListButton.set_tooltip_text(_('Play'));
                this.rowGrid.attach(this._playListButton, 0, 0, 2, 2);
                this._playListButton.show();
                this._playListButton.connect('clicked', button => { // eslint-disable-line
                    let row = button.get_parent().get_parent();
                    this.listBox.select_row(row);
                    play.passSelected(row);
                    this.onPlayPauseToggled(row, file);
                });

                // pause button
                this.pauseImage = Gtk.Image.new();
                this.pauseImage.set_from_icon_name('media-playback-pause-symbolic', Gtk.IconSize.BUTTON);
                this._pauseListButton = new Gtk.Button({ name: 'PauseButton',
                    hexpand: false,
                    vexpand: true });
                this._pauseListButton.set_image(this.pauseImage);
                this._pauseListButton.set_tooltip_text(_('Pause'));
                this.rowGrid.attach(this._pauseListButton, 0, 0, 2, 2);
                this._pauseListButton.hide();
                this._pauseListButton.connect('clicked', button => {
                    let row = button.get_parent().get_parent();
                    this.listBox.select_row(row);
                    this.onPause(row);
                });

                this._fileName = new Gtk.Label({ name: 'FileNameLabel',
                    ellipsize: Pango.EllipsizeMode.END,
                    halign: Gtk.Align.START,
                    valign: Gtk.Align.START,
                    margin_start: 15,
                    margin_top: 5,
                    use_markup: true,
                    width_chars: 35,
                    xalign: 0 });
                let markup = `<b>${file.fileName}</b>`;
                this._fileName.label = markup;
                this._fileName.set_no_show_all(true);
                this.rowGrid.attach(this._fileName, 3, 0, 10, 3);
                this._fileName.show();

                this._playLabelBox = new Gtk.Box({ name: 'PlayLabelBox',
                    orientation: Gtk.Orientation.HORIZONTAL,
                    height_request: 45 });
                this.rowGrid.attach(this._playLabelBox, 3, 1, 5, 1);
                this._playLabelBox.show();
                this.playDurationLabel = new Gtk.Label({ name: 'PlayDurationLabel',
                    halign: Gtk.Align.END,
                    valign: Gtk.Align.END,
                    margin_start: 15,
                    margin_top: 5 });
                this.fileDuration = this._formatTime(file.duration / Gst.SECOND);
                this.playDurationLabel.label = this.fileDuration;
                this._playLabelBox.pack_start(this.playDurationLabel, false, true, 0);
                this.playDurationLabel.show();

                this.dividerLabel = new Gtk.Label({ name: 'DividerLabel',
                    halign: Gtk.Align.START,
                    valign: Gtk.Align.END,
                    margin_top: 5 });
                this.dividerLabel.label = '/';
                this._playLabelBox.pack_start(this.dividerLabel, false, true, 0);
                this.dividerLabel.hide();

                this.playTimeLabel = new Gtk.Label({ name: 'PlayTimeLabel',
                    halign: Gtk.Align.START,
                    valign: Gtk.Align.END,
                    margin_end: 15,
                    margin_top: 5 });
                this.playTimeLabel.label = '0:00';
                this._playLabelBox.pack_start(this.playTimeLabel, false, true, 0);
                this.playTimeLabel.hide();

                // Date Modified label
                this.dateModifiedLabel = new Gtk.Label({ name: 'DateModifiedLabel',
                    halign: Gtk.Align.END,
                    valign: Gtk.Align.END,
                    margin_start: 15,
                    margin_top: 5 });
                this.dateModifiedLabel.label = file.dateModified;
                this.dateModifiedLabel.get_style_context().add_class('dim-label');
                this.dateModifiedLabel.set_no_show_all(true);
                this.rowGrid.attach(this.dateModifiedLabel, 3, 1, 6, 1);
                this.dateModifiedLabel.show();

                this.waveFormGrid = new Gtk.Grid({ name: 'WaveFormGrid',
                    hexpand: true,
                    vexpand: true,
                    orientation: Gtk.Orientation.VERTICAL,
                    valign: Gtk.Align.FILL });
                this.waveFormGrid.set_no_show_all(true);
                this.rowGrid.attach(this.waveFormGrid, 12, 1, 17, 2);
                this.waveFormGrid.show();

                // info button
                this._info = new Gtk.Button({ name: 'InfoButton',
                    hexpand: false,
                    vexpand: true,
                    margin_end: 2 });
                this._info.image = Gtk.Image.new_from_icon_name('dialog-information-symbolic', Gtk.IconSize.BUTTON);
                this._info.connect('clicked', button => {
                    let row = button.get_parent().get_parent();
                    this.listBox.select_row(row);
                    this._onInfoButton(file);
                });
                this._info.set_tooltip_text(_('Info'));
                this.rowGrid.attach(this._info, 27, 0, 1, 2);
                this._info.hide();

                // delete button
                this._delete = new Gtk.Button({ name: 'DeleteButton',
                    hexpand: false,
                    margin_start: 2 });
                this._delete.image = Gtk.Image.new_from_icon_name('user-trash-symbolic', Gtk.IconSize.BUTTON);
                this._delete.connect('clicked', button => {
                    let row = button.get_parent().get_parent();
                    this.listBox.select_row(row);
                    this._deleteFile(row);
                });
                this._delete.set_tooltip_text(_('Delete'));
                this.rowGrid.attach(this._delete, 28, 0, 1, 2);
                this._delete.hide();

            });
        }
        list.monitorListview();
    }

    listBoxRefresh() {
        previousSelRow = null;

        if (this.listBox)
            this.listBox.set_selection_mode(Gtk.SelectionMode.NONE);


        list.setListTypeRefresh();
        list.enumerateDirectory();
    }

    scrolledWinDelete() {
        this._scrolledWin.destroy();
        this.scrolledWinAdd();
    }

    hasPreviousSelRow() {
        if (previousSelRow !== null) {
            let rowGrid = previousSelRow.get_child();
            rowGrid.foreach(child => {
                let alwaysShow = child.get_no_show_all();

                if (!alwaysShow)
                    child.hide();

                if (child.name === 'PauseButton') {
                    child.hide();
                    child.sensitive = false;
                }
                if (child.name === 'PlayButton') {
                    child.show();
                    child.sensitive = true;
                }

                if (child.name === 'PlayLabelBox') {
                    child.show();
                    child.foreach(grandchild => {
                        if (grandchild.name === 'PlayTimeLabel')
                            grandchild.hide();


                        if (grandchild.name === 'DividerLabel')
                            grandchild.hide();

                    });
                }
            });

            if (play.getPipeStates() === PipelineStates.PLAYING || play.getPipeStates() === PipelineStates.PAUSED)
                play.stopPlaying();

        }
        previousSelRow = null;
    }

    rowGridCallback() {
        let selectedRow = this.listBox.get_selected_row();

        if (selectedRow) {
            if (previousSelRow !== null)
                this.hasPreviousSelRow();


            previousSelRow = selectedRow;
            let selectedRowGrid = previousSelRow.get_child();
            selectedRowGrid.show_all();
            selectedRowGrid.foreach(child => {
                let alwaysShow = child.get_no_show_all();

                if (!alwaysShow)
                    child.sensitive = true;

                if (child.name === 'PauseButton') {
                    child.hide();
                    child.sensitive = false;
                }

                if (child.name === 'WaveFormGrid')
                    child.sensitive = true;
            });
        }
    }

    _getFileFromRow(selected) {
        let fileForAction = null;
        let rowGrid = selected.get_child();
        rowGrid.foreach(child => {
            if (child.name === 'FileNameLabel') {
                let name = child.get_text();
                let application = Gio.Application.get_default();
                fileForAction = application.saveDir.get_child_for_display_name(name);
            }
        });

        return fileForAction;
    }

    _deleteFile(selected) {
        let fileToDelete = this._getFileFromRow(selected);
        fileToDelete.trash_async(GLib.PRIORITY_DEFAULT, null, null);
    }

    loadPlay(selected) {
        let fileToPlay = this._getFileFromRow(selected);

        return fileToPlay;
    }

    _onInfoButton(selected) {
        let infoDialog = new Info.InfoDialog(selected);

        infoDialog.widget.connect('response', () => {
            infoDialog.widget.destroy();
        });
    }

    setLabel(time) {
        this.time = time;

        this.timeLabelString = this._formatTime(time);

        if (setVisibleID === ActiveArea.RECORD) {
            this.recordTimeLabel.label = this.timeLabelString;
            this.recordTimeLabel.get_style_context().add_class('dim-label');
        } else if (setVisibleID === ActiveArea.PLAY) {
            this.playTimeLabel.label = this.timeLabelString;
        }
    }

    setNameLabel(newName, oldName, index) {

        let selected = this.listBox.get_row_at_index(index);
        let rowGrid = selected.get_child();
        rowGrid.foreach(child => {
            if (child.name === 'FileNameLabel') {
                let markup = `<b>${newName}</b>`;
                child.label = markup;
            }
        });
        rowGrid.set_name(newName);
    }

    onPause(listRow) {
        let activeState = play.getPipeStates();

        if (activeState === PipelineStates.PLAYING) {
            play.pausePlaying();

            let rowGrid = listRow.get_child();
            rowGrid.foreach(child => {
                if (child.name === 'PauseButton') {
                    child.hide();
                    child.sensitive = false;
                }

                if (child.name === 'PlayButton') {
                    child.show();
                    child.sensitive = true;
                }
            });
        }
    }

    onPlayPauseToggled(listRow, selFile) {
        setVisibleID = ActiveArea.PLAY;
        let activeState = play.getPipeStates();

        if (activeState !== PipelineStates.PLAYING) {
            play.startPlaying();


            let rowGrid = listRow.get_child();
            rowGrid.foreach(child => {
                if (child.name === 'InfoButton' || child.name === 'DeleteButton' ||
                    child.name === 'PlayButton') {
                    child.hide();
                    child.sensitive = false;
                }

                if (child.name === 'PauseButton') {
                    child.show();
                    child.sensitive = true;
                }

                if (child.name === 'PlayLabelBox') {
                    child.foreach(grandchild => {
                        if (grandchild.name === 'PlayTimeLabel')
                            view.playTimeLabel = grandchild;


                        if (grandchild.name === 'DividerLabel')
                            grandchild.show();

                    });
                }

                if (child.name === 'WaveFormGrid') {
                    this.wFGrid = child;
                    child.sensitive = true;
                }
            });

            if (activeState !== PipelineStates.PAUSED)
                wave = new Waveform.WaveForm(this.wFGrid, selFile);

        }
    }
});
