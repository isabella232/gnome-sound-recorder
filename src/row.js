/* exported Row RowState */
const { Gdk, GObject, Gtk } = imports.gi;
const { displayDateTime, formatTime } = imports.utils;

const RowState = {
    PLAYING: 0,
    PAUSED: 1,
};

var Row = GObject.registerClass({
    Template: 'resource:///org/gnome/SoundRecorder/ui/row.ui',
    InternalChildren: ['playbackStack', 'mainStack', 'playButton', 'pauseButton', 'name', 'entry', 'date', 'duration', 'saveBtn'],
    Signals: {
        'play': { param_types: [GObject.TYPE_STRING] },
        'pause': {},
        'deleted': {},
    },
}, class Row extends Gtk.ListBoxRow {
    _init(recording) {
        super._init({});
        this._recording = recording;

        recording.bind_property('name', this._name, 'label', GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.DEFAULT);
        recording.bind_property('name', this._entry, 'text', GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.DEFAULT);

        this._editMode = false;

        this._entry.connect('key-press-event', (_, event) => {
            const key = event.get_keyval()[1];
            this._entry.get_style_context().remove_class('error');

            if (key === Gdk.KEY_Escape)
                this.editMode = false;
        });

        if (recording.timeCreated > 0)
            this._date.label = displayDateTime(recording.timeCreated);
        else
            this._date.label = displayDateTime(recording.timeModified);

        recording.connect('notify::duration', () => {
            this._duration.label = formatTime(recording.duration);
        });

        this._playButton.connect('clicked', () => {
            this.setState(RowState.PLAYING);
            this.emit('play', recording.uri);
        });

        this._pauseButton.connect('clicked', () => {
            this.setState(RowState.PAUSED);
            this.emit('pause');
        });

        // this._deleteButton.connect('clicked', () => {
        //     recording.delete();
        //     this.emit('deleted');
        // });
    }

    onSaveRecording() {
        try {
            if (this._name.label !== this._entry.text)
                this._recording.name = this._entry.text;

            this.editMode = false;
            this._entry.get_style_context().remove_class('error');
        } catch (e) {
            this._entry.get_style_context().add_class('error');
        }
    }

    setState(rowState) {
        if (rowState === RowState.PLAYING)
            this._playbackStack.visible_child_name = 'pause';
        else if (rowState === RowState.PAUSED)
            this._playbackStack.visible_child_name = 'play';
    }

    set editMode(state) {
        this._mainStack.visible_child_name = state ? 'edit' : 'display';

        if (state) {
            this._entry.grab_focus();
            this._saveBtn.grab_default();
        }
    }
});
