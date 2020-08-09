/* exported RecordingList */
const { Gio, GLib, GObject } = imports.gi;

const { RecordingsDir } = imports.application;
const { Recording } = imports.recording;

var RecordingList = new GObject.registerClass(class RecordingList extends Gio.ListStore {
    _init() {
        super._init({ });

        // Monitor Direcotry actions
        this.dirMonitor = RecordingsDir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        this.dirMonitor.connect('changed', (_dirMonitor, file1, file2, eventType) => {
            const index = this.getIndex(file1);

            switch (eventType) {
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

        this.copyOldFiles();
    }

    copyOldFiles() {
        // Necessary code to move old recordings into the new location for few releases
        // FIXME: Remove by 3.40/3.42
        const oldDir = Gio.file_new_for_path(GLib.build_filenamev([GLib.get_home_dir(), _('Recordings')]));

        if (!oldDir.query_exists(null))
            return;

        const fileEnumerator = oldDir.enumerate_children('standard::name', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, null);
        let allCopied = true;

        const copyFiles = function (obj, res) {
            const fileInfos = obj.next_files_finish(res);
            if (fileInfos.length) {
                fileInfos.forEach(info => {
                    const name = info.get_name();
                    const src = oldDir.get_child(name);
                    /* Translators: ""%s (Old)"" is the new name assigned to a file moved from
                        the old recordings location */
                    const dest = RecordingsDir.get_child(_('%s (Old)').format(name));

                    src.copy_async(dest, Gio.FileCopyFlags.BACKUP, GLib.PRIORITY_LOW, null, null, (objCopy, resCopy) => {
                        try {
                            objCopy.copy_finish(resCopy);
                            objCopy.trash_async(GLib.PRIORITY_LOW, null, null);
                            this.dirMonitor.emit_event(dest, src, Gio.FileMonitorEvent.MOVED_IN);
                        } catch (e) {
                            log(`Failed to copy recording ${name} to the new location`);
                            log(e);
                            allCopied = false;
                        }
                    });

                });
                fileEnumerator.next_files_async(5, GLib.PRIORITY_LOW, null, copyFiles);
            } else {
                fileEnumerator.close(null);
                if (allCopied) {
                    oldDir.delete_async(GLib.PRIORITY_LOW, null, (objDelete, resDelete) => {
                        try {
                            objDelete.delete_finish(resDelete);
                        } catch (e) {
                            log('Failed to remove the old Recordings directory. Ignore if you\'re using flatpak');
                            log(e);
                        }
                    });
                }
            }
        }.bind(this);
        fileEnumerator.next_files_async(5, GLib.PRIORITY_LOW, null, copyFiles);
    }

    _enumerateDirectory(obj, res) {
        this._enumerator = obj.enumerate_children_finish(res);
        if (this._enumerator === null) {
            log('The contents of the Recordings directory were not indexed.');
            return;
        }
        this._enumerator.next_files_async(5, GLib.PRIORITY_LOW, null, this._onNextFiles.bind(this));
    }

    _onNextFiles(obj, res) {
        let fileInfos = obj.next_files_finish(res);
        if (fileInfos.length) {
            fileInfos.forEach(info => {
                const file = RecordingsDir.get_child(info.get_name());
                const recording = new Recording(file);
                this.sortedInsert(recording);
            });
            this._enumerator.next_files_async(5, GLib.PRIORITY_LOW, null, this._onNextFiles.bind(this));
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
