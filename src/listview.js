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

var _ = imports.gettext.gettext;
var Gio = imports.gi.Gio;
var GLib = imports.gi.GLib;
var GObject = imports.gi.GObject;
var Gst = imports.gi.Gst;
var GstPbutils = imports.gi.GstPbutils;
var Lang = imports.lang;
var Signals = imports.signals;

var AudioProfile = imports.audioProfile;
var MainWindow = imports.mainWindow;
var Record = imports.record;

var EnumeratorState = {
    ACTIVE: 0,
    CLOSED: 1
};

var mediaTypeMap = {
    FLAC: "FLAC",
    OGG_VORBIS: "Ogg Vorbis",
    OPUS: "Opus",
    MP3: "MP3",
    MP4: "MP4"
};

var ListType = {
    NEW: 0,
    REFRESH: 1
};

var CurrentlyEnumerating = {
    TRUE: 0,
    FALSE: 1
};

var allFilesInfo = null;
var currentlyEnumerating = null;
var fileInfo = null;
var listType = null;
var startRecording = false;
var stopVal = null;
var trackNumber = 0;

var Listview = new Lang.Class({
    Name: "Listview",

    _init: function() {
        stopVal = EnumeratorState.ACTIVE;
        allFilesInfo = [];

        // Save a reference to the savedir to quickly access it
        this._saveDir = Gio.Application.get_default().saveDir;
    },

    monitorListview: function() {
        this.dirMonitor = this._saveDir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
        this.dirMonitor.connect('changed', this._onDirChanged);
    },

    enumerateDirectory: function() {
        this._saveDir.enumerate_children_async('standard::display-name,time::created,time::modified',
                                     Gio.FileQueryInfoFlags.NONE,
                                     GLib.PRIORITY_LOW,
                                     null, Lang.bind(this,
                                     this._onEnumerator));
    },

    _onEnumerator: function(obj, res) {
        this._enumerator = obj.enumerate_children_finish(res);

        if (this._enumerator == null)
            log("The contents of the Recordings directory were not indexed.");
        else
            this._onNextFileComplete();
    },

    _onNextFileComplete: function () {
        fileInfo = [];
        try{
            this._enumerator.next_files_async(20, GLib.PRIORITY_DEFAULT, null, Lang.bind(this,
                function(obj, res) {
                    var files = obj.next_files_finish(res);

                    if (files.length) {
                        files.forEach(Lang.bind(this,
                            function(file) {
                                var returnedName = file.get_attribute_as_string("standard::display-name");
                                try {
                                    var returnedNumber = parseInt(returnedName.split(" ")[1]);
                                    if (returnedNumber > trackNumber)
                                        trackNumber = returnedNumber;

                                }  catch (e) {
                                    if (!e instanceof TypeError)
                                        throw e;

                                    log("Tracknumber not returned");
                                    // Don't handle the error
                                }
                                var finalFileName = GLib.build_filenamev([this._saveDir.get_path(),
                                                                          returnedName]);
                                var fileUri = GLib.filename_to_uri(finalFileName, null);
                                var timeVal = file.get_modification_time();
                                var date = GLib.DateTime.new_from_timeval_local(timeVal);
                                var dateModifiedSortString = date.format("%Y%m%d%H%M%S");
                                var dateTime = GLib.DateTime.new_from_timeval_local(timeVal);
                                var dateModifiedDisplayString = MainWindow.displayTime.getDisplayTime(dateTime);
                                var dateCreatedYes = file.has_attribute("time::created");
                                var dateCreatedString = null;
                                if (this.dateCreatedYes) {
                                    var dateCreatedVal = file.get_attribute_uint64("time::created");
                                    var dateCreated = GLib.DateTime.new_from_timeval_local(dateCreatedVal);
                                    dateCreatedString = MainWindow.displayTime.getDisplayTime(dateCreated);
                                }

                                fileInfo =
                                    fileInfo.concat({ appName: null,
                                                      dateCreated: dateCreatedString,
                                                      dateForSort: dateModifiedSortString,
                                                      dateModified: dateModifiedDisplayString,
                                                      duration: null,
                                                      fileName: returnedName,
                                                      mediaType: null,
                                                      title: null,
                                                      uri: fileUri });
                            }));
                        this._sortItems(fileInfo);
                    } else {
                        stopVal = EnumeratorState.CLOSED;
                        this._enumerator.close(null);

                        if (MainWindow.offsetController.getEndIdx() == -1) {
                             if (listType == ListType.NEW) {
                                MainWindow.view.listBoxAdd();
                                MainWindow.view.scrolledWinAdd();
                            } else if (listType == ListType.REFRESH) {
                                MainWindow.view.scrolledWinDelete();
                            }
                            currentlyEnumerating = CurrentlyEnumerating.FALSE;
                        } else {

                        this._setDiscover();
                        }
                        return;
                   }
                }));
        } catch(e) {
            log(e);
        }
    },

    _sortItems: function(fileArr) {
        allFilesInfo = allFilesInfo.concat(fileArr);
        allFilesInfo.sort(function(a, b) {
            return b.dateForSort - a.dateForSort;
        });

        if (stopVal == EnumeratorState.ACTIVE) {
            this._onNextFileComplete();
        }
    },

    getItemCount: function() {
        return allFilesInfo.length;
    },

    _setDiscover: function() {
        this._controller = MainWindow.offsetController;
        this.endIdx = this._controller.getEndIdx();
        this.idx = 0;
        this._discoverer = new GstPbutils.Discoverer();
        this._discoverer.start();
        for (var i = 0; i <= this.endIdx; i++) {
            var file = allFilesInfo[i];
            var uri = file.uri;
            this._discoverer.discover_uri_async(uri);
        }
        this._runDiscover();
     },

     _runDiscover: function() {
          this._discoverer.connect('discovered', Lang.bind(this,
            function(_discoverer, info, error) {
                var result = info.get_result();
                this._onDiscovererFinished(result, info, error);
             }));
    },

    _onDiscovererFinished: function(res, info, err) {
        this.result = res;
        if (this.result == GstPbutils.DiscovererResult.OK && allFilesInfo[this.idx]) {
            this.tagInfo = info.get_tags();
            var appString = "";
            appString = this.tagInfo.get_value_index(Gst.TAG_APPLICATION_NAME, 0);
            var dateTimeTag = this.tagInfo.get_date_time('datetime')[1];
            var durationInfo = info.get_duration();
            allFilesInfo[this.idx].duration = durationInfo;

            /* this.file.dateCreated will usually be null since time::created it doesn't usually exist.
               Therefore, we prefer to set it with tags */
            if (dateTimeTag != null) {
                var dateTimeCreatedString = dateTimeTag.to_g_date_time();

                if (dateTimeCreatedString) {
                    allFilesInfo[this.idx].dateCreated = MainWindow.displayTime.getDisplayTime(dateTimeCreatedString);
                }
            }

            if (appString == GLib.get_application_name()) {
                allFilesInfo[this.idx].appName = appString;
            }

            this._getCapsForList(info);
        } else {
            // don't index files we can't play
            allFilesInfo.splice(this.idx, 1);
            log("File cannot be played");
        }

        if (this.idx == this.endIdx) {
            this._discoverer.stop();
            if (listType == ListType.NEW) {
                MainWindow.view.listBoxAdd();
                MainWindow.view.scrolledWinAdd();
                currentlyEnumerating = CurrentlyEnumerating.FALSE;
            } else if (listType == ListType.REFRESH){
                MainWindow.view.scrolledWinDelete();
                currentlyEnumerating = CurrentlyEnumerating.FALSE;
            }
            //return false;
        }
        this.idx++;
    },

    setListTypeNew: function() {
        listType = ListType.NEW;
    },

    setListTypeRefresh: function() {
        listType = ListType.REFRESH;
    },

    _onDirChanged: function(dirMonitor, file1, file2, eventType) {
        if (eventType == Gio.FileMonitorEvent.DELETED && Gio.Application.get_default().saveDir.equal(file1)) {
            Gio.Application.get_default().ensure_directory();
            this._saveDir = Gio.Application.get_default().saveDir;
        }
        if ((eventType == Gio.FileMonitorEvent.MOVED_OUT) ||
            (eventType == Gio.FileMonitorEvent.CHANGES_DONE_HINT
                && MainWindow.recordPipeline == MainWindow.RecordPipelineStates.STOPPED) || (eventType == Gio.FileMonitorEvent.RENAMED)) {
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
            startRecording = true;
        }
    },

    _onDirChangedDeb: function(dirMonitor, file1, file2, eventType) {
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
            startRecording = true;
        }
    },

    _getCapsForList: function(info) {
        var discovererStreamInfo = null;
        discovererStreamInfo = info.get_stream_info();
        var containerStreams = info.get_container_streams()[0];
        var containerCaps = discovererStreamInfo.get_caps();
        var audioStreams = info.get_audio_streams()[0];
        var audioCaps =  audioStreams.get_caps();

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
    },

    capTypes: function(capString) {
    	var caps = Gst.Caps.from_string(capString);
    	return caps;
    },

    getFilesInfoForList: function() {
        return allFilesInfo;
    }
});


