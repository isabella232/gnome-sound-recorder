/* exported Listview */
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
 *
 * Author: Meg Ford <megford@gnome.org>
 *
 */

const _ = imports.gettext.gettext;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gst = imports.gi.Gst;
const GstPbutils = imports.gi.GstPbutils;
const Signals = imports.signals;


const Recording  = imports.recording.Recording;
const AudioProfile = imports.audioProfile;
const MainWindow = imports.mainWindow;
const Recorder = imports.recorder.Recorder;


const utils = imports.utils;

const EnumeratorState = {
    ACTIVE: 0,
    CLOSED: 1
};

const mediaTypeMap = {
    FLAC: "FLAC",
    OGG_VORBIS: "Ogg Vorbis",
    OPUS: "Opus",
    MP3: "MP3",
    MP4: "MP4"
};

const ListType = {
    NEW: 0,
    REFRESH: 1
};

const CurrentlyEnumerating = {
    TRUE: 0,
    FALSE: 1
};


let currentlyEnumerating = null;
let fileInfo = null;
let listType = null;
let startRecording = false;
let stopVal = null;

var RecordingsManager = GObject.registerClass({
    Signals: {
      'recording-added': {
        flags: GObject.SignalFlags.RUN_FIRST,
        param_types: [ GObject.Object ]
      }
    }
  },
  class RecordingsManager extends GObject.Object {
    _init() {
        super._init();

        stopVal = EnumeratorState.ACTIVE;
        this._recordings = [];

        this._recorder = new Recorder();

        // Save a reference to the savedir to quickly access it
        this._saveDir = Gio.Application.get_default().saveDir;
        this.enumerateDirectory();
        this.dirMonitor = this._saveDir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        this.dirMonitor.connect('changed', (dirMonitor, file1, file2, eventType) => this._onDirChanged(dirMonitor, file1, file2, eventType));

    }

    getTracksCount() {
      return this._recordings.length;
    }

    startNewRecording() {
      if (!this._recorder.isRecording()) {
          var dir = Gio.Application.get_default().saveDir;
          var clipNumber = this._recordings.length + 1;
          /* Translators: ""Clip %d"" is the default name assigned to a file created
              by the application (for example, "Clip 1"). */
          var clipName = _("Clip %d").format(clipNumber.toString());
          let clipFile = dir.get_child_for_display_name(clipName);
          this._recorder.startNewRecording(clipFile);
          return this._recorder.wave;
      }
    }

    saveRecording() {
      let clipFile = this._recorder.stopRecording();
      let fileInfo = clipFile.query_info('standard::display-name,time::created,time::modified',
                                          Gio.FileQueryInfoFlags.NONE, null)
      let recording = new Recording(fileInfo);
      this._recordings.push(recording);
      this.emit("recording-added", recording);

    }

    enumerateDirectory() {
        this._saveDir.enumerate_children_async('standard::display-name,time::created,time::modified',
                                     Gio.FileQueryInfoFlags.NONE,
                                     GLib.PRIORITY_LOW,
                                     null,
                                     (obj, res) => this._onEnumerator(obj, res));
    }

    _onEnumerator(obj, res) {
        this._enumerator = obj.enumerate_children_finish(res);

        if (this._enumerator == null)
            log("The contents of the Recordings directory were not indexed.");
        else
            this._onNextFileComplete();
    }

    _onNextFileComplete () {
        fileInfo = [];
        try{
            this._enumerator.next_files_async(20, GLib.PRIORITY_DEFAULT, null, (obj, res) => {
                let files = obj.next_files_finish(res);


                files.forEach((file) => {

                   let recording = new Recording(file);
                   this._recordings.push(recording);
                    this.emit("recording-added", recording);

                });
                // this._sortItems(fileInfo);
            });
        } catch(e) {
            log(e);
        }
    }


    _onDirChanged(dirMonitor, file1, file2, eventType) {

        if (eventType == Gio.FileMonitorEvent.DELETED && Gio.Application.get_default().saveDir.equal(file1)) {
            Gio.Application.get_default().ensure_directory();
            this._saveDir = Gio.Application.get_default().saveDir;
        }
        if ((eventType == Gio.FileMonitorEvent.MOVED_OUT) ||
            (eventType == Gio.FileMonitorEvent.CHANGES_DONE_HINT
                && MainWindow.recordPipeline == MainWindow.RecordPipelineStates.STOPPED) || (eventType == Gio.FileMonitorEvent.RENAMED)) {
            stopVal = EnumeratorState.ACTIVE;

            listType = ListType.REFRESH;

            if (currentlyEnumerating == CurrentlyEnumerating.FALSE) {
                currentlyEnumerating = CurrentlyEnumerating.TRUE;
                MainWindow.view.listBoxRefresh();
            }
        }
        log(eventType);
        if (eventType == Gio.FileMonitorEvent.CHANGES_DONE_HINT ) {

        }
    }


    _onDirChangedDeb(dirMonitor, file1, file2, eventType) {
        /* Workaround for Debian and Tails not recognizing Gio.FileMointor.WATCH_MOVES */
        if (eventType == Gio.FileMonitorEvent.DELETED && Gio.Application.get_default().saveDir.equal(file1)) {
            Gio.Application.get_default().ensure_directory();
            this._saveDir = Gio.Application.get_default().saveDir;
        }
        if ((eventType == Gio.FileMonitorEvent.DELETED) ||
            (eventType == Gio.FileMonitorEvent.CHANGES_DONE_HINT && MainWindow.recordPipeline == MainWindow.RecordPipelineStates.STOPPED)) {
            stopVal = EnumeratorState.ACTIVE;
            allFilesInfo.length = 0;
            fileInfo.length = 0;
            this.idx = 0;
            listType = ListType.REFRESH;

            if (currentlyEnumerating == CurrentlyEnumerating.FALSE) {
                currentlyEnumerating = CurrentlyEnumerating.TRUE;
                MainWindow.view.listBoxRefresh();
            }
        }

        else if (eventType == Gio.FileMonitorEvent.CREATED) {
            log("hey) ")
            startRecording = true;
        }
    }

    _getCapsForList(info) {
        let discovererStreamInfo = null;
        discovererStreamInfo = info.get_stream_info();
        let containerStreams = info.get_container_streams()[0];
        let containerCaps = discovererStreamInfo.get_caps();
        let audioStreams = info.get_audio_streams()[0];
        let audioCaps =  audioStreams.get_caps();

        if (containerCaps.can_intersect(this.capTypes(AudioProfile.containerProfileMap.AUDIO_OGG))) {

            if (audioCaps.can_intersect(this.capTypes(AudioProfile.audioCodecMap.VORBIS)))
                allFilesInfo[this.idx].mediaType = mediaTypeMap.OGG_VORBIS;
            else if (audioCaps.can_intersect(this.capTypes(AudioProfile.audioCodecMap.OPUS)))
                allFilesInfo[this.idx].mediaType = mediaTypeMap.OPUS;

        } else if (containerCaps.can_intersect(this.capTypes(AudioProfile.containerProfileMap.ID3))) {

            if (audioCaps.can_intersect(this.capTypes(AudioProfile.audioCodecMap.MP3)))
                allFilesInfo[this.idx].mediaType = mediaTypeMap.MP3;

        } else if (containerCaps.can_intersect(this.capTypes(AudioProfile.containerProfileMap.MP4))) {

            if (audioCaps.can_intersect(this.capTypes(AudioProfile.audioCodecMap.MP4)))
                allFilesInfo[this.idx].mediaType = mediaTypeMap.MP4;

        } else if (audioCaps.can_intersect(this.capTypes(AudioProfile.audioCodecMap.FLAC))) {
            allFilesInfo[this.idx].mediaType = mediaTypeMap.FLAC;

        }

        if (allFilesInfo[this.idx].mediaType == null) {
                // Remove the file from the array if we don't recognize it
                allFilesInfo.splice(this.idx, 1);
        }
    }

    capTypes(capString) {
        let caps = Gst.Caps.from_string(capString);
        return caps;
    }
});
