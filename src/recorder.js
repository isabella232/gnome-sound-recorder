/* exported EncodingProfiles Recorder */
/*
 * Copyright 2013 Meg Ford
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Library General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public
 * License along with this library; if not, see <http://www.gnu.org/licenses/>.
 *
 *  Author: Meg Ford <megford@gnome.org>
 *
 */

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gst = imports.gi.Gst;
const GstPbutils = imports.gi.GstPbutils;
const Recording = imports.recording.Recording;
const GObject = imports.gi.GObject;

const Application = imports.application;

// All supported encoding profiles.
var EncodingProfiles = [
    { name: 'VORBIS',
        containerCaps: 'application/ogg;audio/ogg;video/ogg',
        audioCaps: 'audio/x-vorbis',
        mimeType: 'audio/x-vorbis' },

    { name: 'OPUS',
        containerCaps: 'application/ogg',
        audioCaps: 'audio/x-opus',
        mimeType: 'audio/x-opus' },

    { name: 'FLAC',
        containerCaps: 'audio/x-flac',
        audioCaps: 'audio/x-flac',
        mimeType: 'audio/x-flac' },

    { name: 'MP3',
        containerCaps: 'application/x-id3',
        audioCaps: 'audio/mpeg,mpegversion=(int)1,layer=(int)3',
        mimeType: 'audio/mpeg' },

    { name: 'M4A',
        containerCaps: 'video/quicktime,variant=(string)iso',
        audioCaps: 'audio/mpeg,mpegversion=(int)4',
        mimeType: 'audio/mpeg' },
];

var Recorder = new GObject.registerClass({
    Properties: {
        'duration': GObject.ParamSpec.int(
            'duration',
            'Recording Duration', 'Recording duration in seconds',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
            0, GLib.MAXINT16, 0),
    },
    Signals: {
        'waveform': { param_types: [GObject.TYPE_INT, GObject.TYPE_FLOAT] },
    },
}, class Recorder extends GObject.Object {
    _init() {
        super._init({});

        let srcElement, audioConvert, caps;
        try {
            this.pipeline = new Gst.Pipeline({ name: 'pipe' });
            srcElement = Gst.ElementFactory.make('pulsesrc', 'srcElement');
            audioConvert = Gst.ElementFactory.make('audioconvert', 'audioConvert');
            caps = Gst.Caps.from_string('audio/x-raw');
            this.level = Gst.ElementFactory.make('level', 'level');
            this.ebin = Gst.ElementFactory.make('encodebin', 'ebin');
            this.filesink = Gst.ElementFactory.make('filesink', 'filesink');
        } catch (error) {
            log(`Not all elements could be created.\n${error}`);
        }

        try {
            this.pipeline.add(srcElement);
            this.pipeline.add(audioConvert);
            this.pipeline.add(this.level);
            this.pipeline.add(this.ebin);
            this.pipeline.add(this.filesink);
        } catch (error) {
            log(`Not all elements could be addded.\n${error}`);
        }

        this.clock = this.pipeline.get_clock();

        srcElement.link(audioConvert);
        audioConvert.link_filtered(this.level, caps);
    }

    start() {
        this.baseTime = 0;

        const dir = Gio.Application.get_default().saveDir;
        const dateTime = GLib.DateTime.new_now_local();
        /* Translators: ""Recording from %F %A at %T"" is the default name assigned to a file created
            by the application (for example, "Recording from 2020-03-11 Wednesday at 19:43:05"). */
        const clipName = dateTime.format(_('Recording from %F %A at %T'));
        const clip = dir.get_child_for_display_name(clipName);
        const fileUri = clip.get_path();
        this.file = Gio.file_new_for_path(fileUri);

        if (fileUri === -1)
            log('Unable to create Recordings directory.');


        this.recordBus = this.pipeline.get_bus();
        this.recordBus.add_signal_watch();
        this.recordBus.connect('message', (recordBus, message) => {
            if (message !== null)
                this._onMessageReceived(message);
        });


        this.ebin.set_property('profile', this._getProfile());
        this.filesink.set_property('location', fileUri);
        this.level.link(this.ebin);
        this.ebin.link(this.filesink);

        this.state = Gst.State.PLAYING;

        this.timeout = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            const pos = this.pipeline.query_position(Gst.Format.TIME)[1];
            if (pos > 0)
                this.duration = pos / Gst.SECOND;
            return true;
        });
    }

    stop() {
        this.state = Gst.State.NULL;

        if (this.timeout) {
            GLib.source_remove(this.timeout);
            this.timeout = null;
        }

        if (this.recordBus) {
            this.recordBus.remove_watch();
            this.recordBus = null;
        }

        return new Recording(this.file);
    }

    _onMessageReceived(message) {
        switch (message.type) {
        case Gst.MessageType.ELEMENT: {
            if (GstPbutils.is_missing_plugin_message(message)) {
                let detail = GstPbutils.missing_plugin_message_get_installer_detail(message);
                let description = GstPbutils.missing_plugin_message_get_description(message);
                log(`Detail: ${detail}\nDescription: ${description}`);
                break;
            }

            let s = message.get_structure();
            if (s) {
                if (s.has_name('level')) {
                    let peakVal = 0;
                    peakVal = s.get_value('peak');

                    if (peakVal) {
                        let val = peakVal.get_nth(0);

                        if (val > 0)
                            val = 0;

                        const peak = Math.pow(10, val / 20);


                        if  (this.clock === null)
                            this.clock = this.pipeline.get_clock();

                        let absoluteTime;
                        try {
                            absoluteTime = this.clock.get_time();
                        } catch (error) {
                            absoluteTime = 0;
                        }


                        if (this.baseTime === 0)
                            this.baseTime = absoluteTime;

                        const runTime = absoluteTime - this.baseTime;
                        let approxTime = Math.round(runTime / 100000000);
                        this.emit('waveform', approxTime, peak);
                    }
                }
            }
            break;
        }

        case Gst.MessageType.EOS:
            this.stop();
            break;
        case Gst.MessageType.WARNING:
            log(message.parse_warning()[0].toString());
            break;
        case Gst.MessageType.ERROR:
            log(message.parse_error().toString());
            break;
        }
    }

    _getProfile() {
        let profileIndex = Application.settings.get_enum('audio-profile');
        const profile = EncodingProfiles[profileIndex];

        let audioCaps = Gst.Caps.from_string(profile.audioCaps);
        audioCaps.set_value('channels', 2);

        let encodingProfile = GstPbutils.EncodingAudioProfile.new(audioCaps, null, null, 1);
        let containerCaps = Gst.Caps.from_string(profile.containerCaps);
        let containerProfile = GstPbutils.EncodingContainerProfile.new('record', null, containerCaps, null);
        containerProfile.add_profile(encodingProfile);

        return containerProfile;
    }

    get duration() {
        return this._duration;
    }

    set duration(val) {
        this._duration = val;
        this.notify('duration');
    }

    get state() {
        return this._pipeState;
    }

    set state(s) {
        this._pipeState = s;
        const ret = this.pipeline.set_state(this._pipeState);

        if (ret === Gst.StateChangeReturn.FAILURE)
            log('Unable to update the recorder pipeline state');
    }

});
