const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

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
        'deleted': {},
    },
}, class Row extends Gtk.ListBoxRow {
    _init(recording) {
        super._init({});

        this._fileNameLabel.label = recording.name;

        recording.connect('notify::duration', () => {
            this._fileDurationLabel.label = Utils.Time.formatTime(recording.duration);
        });

        this._playButton.connect('clicked', () => {
            this.setState(RowState.PLAYING);
            this.emit('play', recording.uri);
        });

        this._pauseButton.connect('clicked', () => {
            this.setState(RowState.PAUSED);
            this.emit('pause');
        });

        this._infoButton.connect('clicked', () => (new Info.InfoDialog(recording)).show());
        this._deleteButton.connect('clicked', () => {
            recording.delete();
            this.emit('deleted');
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
