/* exported RecordingList */
const { Gio, GLib, GObject } = imports.gi;

const { RecordingsDir } = imports.application;
const { Recording } = imports.recording;

var RecordingList = new GObject.registerClass(class RecordingList extends Gio.ListStore {
    _init() {
        super._init({ });

        // Monitor Direcotry actions
        let dirMonitor = RecordingsDir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        dirMonitor.connect('changed', (_dirMonitor, file1, file2, eventType) => {
            let index = this.getIndex(file1);

            switch (eventType) {
            case Gio.FileMonitorEvent.DELETED:
                if (RecordingsDir.equal(file1))
                    Gio.Application.get_default().ensureDirectory();

                break;
            case Gio.FileMonitorEvent.MOVED_OUT:
                if (index >= 0)
                    this.remove(index);
                break;
            case Gio.FileMonitorEvent.MOVED_IN:
                if (index === -1)
                    this.sortedInsert(new Recording(file1));
                break;
            }

        });

        RecordingsDir.enumerate_children_async('standard::name',
            Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
            GLib.PRIORITY_LOW,
            null,
            this._enumerateDirectory.bind(this));
    }

    _enumerateDirectory(obj, res) {
        this._enumerator = obj.enumerate_children_finish(res);
        if (this._enumerator === null) {
            log('The contents of the Recordings directory were not indexed.');
            return;
        }
        this._enumerator.next_files_async(20, GLib.PRIORITY_LOW, null, this._onNextFiles.bind(this));
    }

    _onNextFiles(obj, res) {
        let fileInfos = obj.next_files_finish(res);
        if (fileInfos.length) {
            fileInfos.forEach(info => {
                const file = RecordingsDir.get_child(info.get_name());
                const recording = new Recording(file);
                this.sortedInsert(recording);
            });
            this._enumerator.next_files_async(20, GLib.PRIORITY_LOW, null, this._onNextFiles.bind(this));
        } else {
            this._enumerator.close(null);
        }
    }

    getIndex(file) {
        for (let i = 0; i < this.get_n_items(); i++) {
            if (this.get_item(i).uri === file.get_uri())
                return i;
        }
        return -1;
    }

    sortedInsert(recording) {
        let added = false;

        for (let i = 0; i < this.get_n_items(); i++) {
            const curr = this.get_item(i);
            if (curr.timeModified.difference(recording.timeModified) <= 0) {
                this.insert(i, recording);
                added = true;
                break;
            }
        }

        if (!added)
            this.append(recording);
    }
});
