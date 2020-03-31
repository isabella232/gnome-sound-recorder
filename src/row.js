const Gst = imports.gi.Gst;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

var Info = imports.info;
var Utils = imports.utils;

var RowState = {
    PLAYING: 0,
    PAUSED: 1,
};

var Row = GObject.registerClass({ // eslint-disable-line no-unused-vars
    Template: 'resource:///org/gnome/SoundRecorder/ui/row.ui',
    InternalChildren: ['playbackStack', 'fileNameLabel', 'fileDurationLabel', 'playButton', 'pauseButton', 'infoButton', 'deleteButton'],
    Signals: {
        'play': { param_types: [GObject.TYPE_STRING] },
        'pause': {},
    },
}, class Row extends Gtk.ListBoxRow {
    _init(file) {
        super._init({});
        this.file = file;

        this._fileNameLabel.label = file.fileName;
        this._fileDurationLabel.label = Utils.StringUtils.formatTime(file.duration / Gst.SECOND);

        this._playButton.connect('clicked', () => {
            this.setState(RowState.PLAYING);
            this.emit('play', this.file.uri);
        });

        this._pauseButton.connect('clicked', () => {
            this.setState(RowState.PAUSED);
            this.emit('pause');
        });

        this._infoButton.connect('clicked', () => (new Info.InfoDialog(file)).show());
        this._deleteButton.connect('clicked', () => {
            let gioFile = Gio.File.new_for_uri(file.uri);
            gioFile.trash_async(GLib.PRIORITY_DEFAULT, null, null);
        });
    }

    setState(rowState) {
        if (rowState === RowState.PLAYING) {
            this._playbackStack.set_visible_child_name('pause');
            this._deleteButton.set_sensitive(false);
        } else if (rowState === RowState.PAUSED) {
            this._playbackStack.set_visible_child_name('play');
            this._deleteButton.set_sensitive(true);
        }
    }
});
