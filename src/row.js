/* exported Row RowState */
const { GObject, Handy } = imports.gi;

var Utils = imports.utils;

const RowState = {
    PLAYING: 0,
    PAUSED: 1,
};

var Row = GObject.registerClass({
    Template: 'resource:///org/gnome/SoundRecorder/ui/row.ui',
    InternalChildren: ['playbackStack', 'action_row', 'playButton', 'pauseButton', 'duration'],
    Signals: {
        'play': { param_types: [GObject.TYPE_STRING] },
        'pause': {},
        'deleted': {},
    },
}, class Row extends Handy.PreferencesRow {
    _init(recording) {
        super._init({});

        this._action_row.title = recording.name;
        this._action_row.subtitle = Utils.Time.getDisplayTime(
            recording.timeCreated > 0 ? recording.timeCreated : recording.timeModified);

        recording.connect('notify::duration', () => {
            this._duration.label = Utils.Time.formatTime(recording.duration);
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

    setState(rowState) {
        if (rowState === RowState.PLAYING)
            this._playbackStack.visible_child_name = 'pause';
        else if (rowState === RowState.PAUSED)
            this._playbackStack.visible_child_name = 'play';
    }
});
