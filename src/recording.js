/* exported Recording */
const { GLib, GObject, GstPbutils } = imports.gi;

var Recording = new GObject.registerClass({
    Properties: {
        'duration': GObject.ParamSpec.int(
            'duration',
            'Recording Duration', 'Recording duration in seconds',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
            0, GLib.MAXINT16, 0),
        'name': GObject.ParamSpec.string(
            'name',
            'Recording Name', 'Recording name in string',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
            null),
    },
}, class Recording extends GObject.Object {
    _init(file) {
        super._init({});
        this._file = file;

        let info = file.query_info('time::created,time::modified', 0, null);

        let timeModified = info.get_attribute_uint64('time::modified');
        let timeCreated = info.get_attribute_uint64('time::created');
        this._timeModified = GLib.DateTime.new_from_unix_local(timeModified);
        this._timeCreated = GLib.DateTime.new_from_unix_local(timeCreated);

        var discoverer = new GstPbutils.Discoverer();
        discoverer.start();
        discoverer.connect('discovered', (_discoverer, audioInfo) => {
            this._duration = audioInfo.get_duration();
            this.notify('duration');
        });

        discoverer.discover_uri_async(this.uri);
    }

    get name() {
        return this._file.get_basename();
    }

    set name(filename) {
        if (filename && filename !== this.name) {
            this._file = this._file.set_display_name(filename, null);
            this.notify('name');
        }
    }

    get timeModified() {
        return this._timeModified;
    }

    get timeCreated() {
        return this._timeCreated;
    }

    get duration() {
        if (this._duration)
            return this._duration;
        else
            return undefined;
    }

    get file() {
        return this._file;
    }

    get uri() {
        return this._file.get_uri();
    }

    delete() {
        return this._file.trash_async(GLib.PRIORITY_DEFAULT, null, null);
    }

});
