/*
* Copyright 2013 Meg Ford
* This library is free software; you can redistribute it and/or
* modify it under the terms of the GNU Library General Public
* License as published by the Free Software Foundation; either
* version 2 of the License, or (at your option) any later version.
*
* This library is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
* Library General Public License for more details.
*
* You should have received a copy of the GNU Library General Public
* License along with this library; if not, see <http://www.gnu.org/licenses/>.
*
*
* Author: Meg Ford <megford@gnome.org>
*/

// based on code from Pitivi

var Cairo = imports.cairo;
var Gio = imports.gi.Gio;
var GLib = imports.gi.GLib;
var GObject = imports.gi.GObject;
var Gst = imports.gi.Gst;
var GstAudio = imports.gi.GstAudio;
var Gtk = imports.gi.Gtk;
var Lang = imports.lang;
var Mainloop = imports.mainloop;

var _ = imports.gettext.gettext;
var C_ = imports.gettext.pgettext;

var MainWindow = imports.mainWindow;
var Application = imports.application;

var INTERVAL = 100000000;
var peaks = [];
var pauseVal = 10;
var waveSamples = 40;

var WaveType = {
    RECORD: 0,
    PLAY: 1
};

var WaveForm = new Lang.Class({
    Name: 'WaveForm',

    _init: function(grid, file) {
        this._grid = grid;

        var placeHolder = -100;
        for (var i = 0; i < 40; i++)
            peaks.push(placeHolder);
        if (file) {
            this.waveType = WaveType.PLAY;
            this.file = file;
            this.duration = this.file.duration;
            this._uri = this.file.uri;
        } else {
          this.waveType = WaveType.RECORD;
        }

        var gridWidth = 0;
        var drawingWidth = 0;
        var drawingHeight = 0;
        this.drawing = Gtk.DrawingArea.new();
        if (this.waveType == WaveType.RECORD) {
            this.drawing.set_property("valign", Gtk.Align.FILL);
            this.drawing.set_property("hexpand",true);
            this._grid.attach(this.drawing, 2, 0, 3, 2);
        } else {
            this.drawing.set_property("valign", Gtk.Align.FILL);
            this.drawing.set_property("hexpand",true);
            this.drawing.set_property("vexpand",true);
            this._grid.add(this.drawing);
        }

        this.drawing.connect("draw", Lang.bind(this, this.fillSurface));
        this.drawing.show_all();
        this._grid.show_all();

        if (this.waveType == WaveType.PLAY) {
            this._launchPipeline();
            this.startGeneration();
        }
    },

    _launchPipeline: function() {
        this.pipeline =
            Gst.parse_launch("uridecodebin name=decode uri=" + this._uri + " ! audioconvert ! audio/x-raw,channels=2 ! level name=level interval=100000000 post-messages=true ! fakesink qos=false");
        this._level = this.pipeline.get_by_name("level");
        var decode = this.pipeline.get_by_name("decode");
        var bus = this.pipeline.get_bus();
        bus.add_signal_watch();
        GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, Application.SIGINT, Application.application.onWindowDestroy);
        GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, Application.SIGTERM, Application.application.onWindowDestroy);

        this.nSamples = Math.ceil(this.duration / INTERVAL);

        bus.connect("message", Lang.bind(this,
            function(bus, message) {

                if (message != null) {
                    this._messageCb(message);
                }
            }));
    },

    _messageCb: function(message) {
        var msg = message.type;

        switch(msg) {
        case Gst.MessageType.ELEMENT:
            var s = message.get_structure();

            if (s) {

                if (s.has_name("level")) {
                    var peaknumber = 0;
                    var st = s.get_value("timestamp");
                    var dur = s.get_value("duration");
                    var runTime = s.get_value("running-time");
                    var peakVal = s.get_value("peak");

                    if (peakVal) {
                        var val = peakVal.get_nth(0);

                        if (val > 0)
                            val = 0;

                        var value = Math.pow(10, val/20);
                        peaks.push(value);
                    }
                }
            }

            if (peaks.length == this.playTime) {
                this.pipeline.set_state(Gst.State.PAUSED);
            }

            if (peaks.length == pauseVal) {
                this.pipeline.set_state(Gst.State.PAUSED);
            }
            break;

        case Gst.MessageType.EOS:
            this.stopGeneration();
            break;
        }
    },

    startGeneration: function() {
        this.pipeline.set_state(Gst.State.PLAYING);
    },

    stopGeneration: function() {
        this.pipeline.set_state(Gst.State.NULL);
    },

    fillSurface: function(drawing, cr) {
        var start = 0;

        if (this.waveType == WaveType.PLAY) {

            if (peaks.length != this.playTime) {
                this.pipeline.set_state(Gst.State.PLAYING);
            }
            start = Math.floor(this.playTime);
        } else {

            if (this.recordTime >= 0)
            start = this.recordTime;
        }

        var i = 0;
        var xAxis = 0;
        var end = start + 40;
        var width = this.drawing.get_allocated_width();
        var waveheight = this.drawing.get_allocated_height();
        var length = this.nSamples;
        var pixelsPerSample = width/waveSamples;
        var gradient = new Cairo.LinearGradient(0, 0, width , waveheight);
        if (this.waveType == WaveType.PLAY) {
              gradient.addColorStopRGBA(0.75, 0.94, 1.0, 0.94, 0.75);
              gradient.addColorStopRGBA(0.0, 0.94, 1.0, 0.94, 0.22);
              cr.setLineWidth(1);
              cr.setSourceRGBA(0.0, 255, 255, 255);
        } else {
            gradient.addColorStopRGBA(0.75, 0.0, 0.72, 0.64, 0.35);
            gradient.addColorStopRGBA(0.0, 0.2, 0.54, 0.47, 0.22);
            cr.setLineWidth(1);
            cr.setSourceRGBA(0.0, 185, 161, 255);
        }

        for(i = start; i <= end; i++) {

            // Keep moving until we get to a non-null array member
            if (peaks[i] < 0) {
                cr.moveTo((xAxis * pixelsPerSample), (waveheight - (peaks[i] * waveheight)))
            }

            // Start drawing when we reach the first non-null array member
            if (peaks[i] != null && peaks[i] >= 0) {
                var idx = i - 1;

                if (start >= 40 && xAxis == 0) {
                     cr.moveTo((xAxis * pixelsPerSample), waveheight);
                }

                cr.lineTo((xAxis * pixelsPerSample), (waveheight - (peaks[i] * waveheight)));
            }

            xAxis += 1;
        }
        cr.lineTo(xAxis * pixelsPerSample, waveheight);
        cr.closePath();
        cr.strokePreserve();
        cr.setSource(gradient);
	    cr.fillPreserve();
	    cr.$dispose();
    },

    _drawEvent: function(playTime, recPeaks) {
        var lastTime;

        if (this.waveType == WaveType.PLAY) {
            lastTime = this.playTime;
            this.playTime = playTime;

            if (peaks.length < this.playTime) {
                this.pipeline.set_state(Gst.State.PLAYING);
            }

            if (lastTime != this.playTime) {
                this.drawing.queue_draw();
            }

        } else {
            peaks.push(recPeaks);
            lastTime = this.recordTime;
            this.recordTime = playTime;

            if (peaks.length < this.recordTime) {
                log("error");
                return true;
            }
            if (this.drawing)
                this.drawing.queue_draw();
        }
        return true;
    },

    endDrawing: function() {
        if (this.pipeline)
            this.stopGeneration();

        this.count = 0;
        peaks.length = 0;
        try {
            this.drawing.destroy();
        } catch (e) {
            log(e);
        }
    }
});
