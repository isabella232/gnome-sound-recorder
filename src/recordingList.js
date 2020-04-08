const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const Recording = imports.recording.Recording;


var RecordingList = new GObject.registerClass(class RecordingList extends Gio.ListStore {  // eslint-disable-line no-unused-vars
    _init() {
        super._init({ });
        this._saveDir = Gio.Application.get_default().saveDir;

        // Monitor Direcotry actions
        let dirMonitor = this._saveDir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        dirMonitor.connect('changed', (_dirMonitor, file1, file2, eventType) => {
            // Monitor if file action done on _saveDir
            let index = this.getIndex(file1);

            switch (eventType) {
            case Gio.FileMonitorEvent.DELETED:
                if (Gio.Application.get_default().saveDir.equal(file1)) {
                    Gio.Application.get_default().ensureDirectory();
                    this._saveDir = Gio.Application.get_default().saveDir;
                }
                break;
            case Gio.FileMonitorEvent.MOVED_OUT:
                if (index >= 0)
                    this.remove(index);
                break;
            case Gio.FileMonitorEvent.MOVED_IN:
                if (index === -1)
                    this.insert(0, new Recording(file1));
                break;
            }

        });
        this._watchDir();
    }

    _watchDir() {
        this._saveDir.enumerate_children_async('standard::name',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
            GLib.PRIORITY_LOW,
            null,
            (obj, res) => this._enumerateDirectory(obj, res));
    }


    _enumerateDirectory(obj, res) {
        this._enumerator = obj.enumerate_children_finish(res);

        if (this._enumerator === null) {
            log('The contents of the Recordings directory were not indexed.');
        } else {
            this._enumerator.next_files_async(20, GLib.PRIORITY_DEFAULT, null, (_obj, _res) => {
                let fileInfos = _obj.next_files_finish(_res);
                if (fileInfos.length > 0) {
                    fileInfos.forEach(info => {
                        let path = GLib.build_filenamev([this._saveDir.get_path(), info.get_name()]);
                        let file = Gio.file_new_for_path(path);
                        let recording = new Recording(file);
                        this.append(recording);
                    });
                } else {
                    this._enumerator.close(null);
                }
            });
        }
    }

    getIndex(file) {
        for (var i = 0; i < this.get_n_items(); i++) {
            if (this.get_item(i).uri === file.get_uri())
                return i;
        }
        return -1;
    }
});
