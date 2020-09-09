/* exported RecorderState RecorderWidget */
const { Gdk, Gio, GObject, Gst, Gtk } = imports.gi;
const { displayDateTime, formatTime } = imports.utils;
const { WaveForm, WaveType } = imports.waveform;

var RecorderState = {
    RECORDING: 0,
    PAUSED: 1,
    STOPPED: 2,
}

var RecorderWidget = GObject.registerClass({
    Template: 'resource:///org/gnome/SoundRecorder/ui/recorder.ui',
    InternalChildren: ['recorderBox', 'playbackStack', 'recorderTime', ],
    Signals: {
        'canceled': {},
        'paused': {},
        'resumed': {},
        'started': {},
        'stopped': { param_types: [GObject.TYPE_OBJECT] },
    },
}, class RecorderWidget extends Gtk.Bin {
    _init(recorder) {
        super._init({});
        this.recorder = recorder;

        this.waveform = new WaveForm({
            vexpand: true,
            valign: Gtk.Align.FILL,
        }, WaveType.RECORDER);
        this._recorderBox.add(this.waveform);

        this.recorder.bind_property('current-peak', this.waveform, 'peak', GObject.BindingFlags.SYNC_CREATE | GObject.BindingFlags.DEFAULT);
        this.recorder.connect('notify::duration', _recorder => {
            this._recorderTime.label = formatTime(_recorder.duration);
        });


        const actions = [
            { name: 'start', callback : this.onStart.bind(this), enabled: true },
            { name: 'pause', callback : this.onPause.bind(this), enabled: false },
            { name: 'stop', callback : this.onStop.bind(this), enabled: false,  },
            { name: 'resume', callback : this.onResume.bind(this), enabled: false },
            { name: 'cancel', callback : this.onCancel.bind(this), enabled: false }
        ];

        this.actionsGroup = new Gio.SimpleActionGroup();

        for ( let { name, callback, enabled } of actions) {
            const action = new Gio.SimpleAction({ name: name, enabled: enabled });
            action.connect('activate', callback);
            this.actionsGroup.add_action(action);
        }

        const cancelAction = this.actionsGroup.lookup('cancel');
        const startAction = this.actionsGroup.lookup('start');
        startAction.bind_property("enabled", cancelAction, "enabled", GObject.BindingFlags.INVERT_BOOLEAN);
    }

    onPause() {
        this._playbackStack.visible_child_name = 'recorder-start';
        this.state = RecorderState.PAUSED;

        this.recorder.pause();
        this.emit('paused');
    }

    onResume() {
        this._playbackStack.visible_child_name = 'recorder-pause';
        this.state = RecorderState.RECORDING;

        this.recorder.resume();
        this.emit('resumed');
    }

    onStart() {
        this._playbackStack.visible_child_name = 'recorder-pause';
        this.state = RecorderState.RECORDING;

        this.recorder.start();
        this.emit('started');
    }

    onCancel() {
        const recording = this.recorder.stop();
        this.state = RecorderState.STOPPED;
        this.waveform.destroy();

        recording.delete();
        this.emit('canceled');
    }

    onStop() {
        this.state = RecorderState.STOPPED;
        const recording = this.recorder.stop();
        this.waveform.destroy();
        this.emit('stopped', recording);
    }

    set state(recorderState) {
        switch (recorderState) {
            case RecorderState.PAUSED:
                this.actionsGroup.lookup('pause').set_enabled(false);
                this.actionsGroup.lookup('resume').set_enabled(true);
                break;
            case RecorderState.RECORDING:
                this.actionsGroup.lookup('start').set_enabled(false);
                this.actionsGroup.lookup('stop').set_enabled(true);
                this.actionsGroup.lookup('resume').set_enabled(false);
                this.actionsGroup.lookup('pause').set_enabled(true);
                break;
            case RecorderState.STOPPED:
                this.actionsGroup.lookup('start').set_enabled(true);
                this.actionsGroup.lookup('stop').set_enabled(false);
                break;
        }
    }
});
