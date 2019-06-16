/* exported WaveForm */
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

const Cairo = imports.cairo;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gst = imports.gi.Gst;
const GstAudio = imports.gi.GstAudio;
const Gtk = imports.gi.Gtk;
const Mainloop = imports.mainloop;

const _ = imports.gettext.gettext;
const C_ = imports.gettext.pgettext;

const MainWindow = imports.mainWindow;
const Application = imports.application;

const SAMPLE_DURATION = Gst.SECOND / 100;
const peaks = [];
const pauseVal = 10;
const waveSamples = 40;

const WaveType = {
    RECORD: 0,
    PLAY: 1
};

var WaveForm =  GObject.registerClass(class WaveForm extends Gtk.DrawingArea {
    _init(recording) {
        super._init();
        let placeHolder = -100;
        for (let i = 0; i < 40; i++)
            peaks.push(placeHolder);
        if (recording) {
            this.waveType = WaveType.PLAY;
            this.duration = recording.duration;
            this._uri = recording.uri;
        } else {
          this.waveType = WaveType.RECORD;
        }
        this.recordTime = -1;
        this.playTime = 0;

        let gridWidth = 0;
        let drawingWidth = 0;
        let drawingHeight = 0;

        this.set_property("hexpand", true);

        this.connect("draw", (drawing, cr) => this.fillSurface(cr));

        if (this.waveType == WaveType.PLAY) {
            this._launchPipeline();
            this.startGeneration();

        }
        this.show_all();

    }

    _launchPipeline() {
        this.pipeline =
            Gst.parse_launch("uridecodebin name=decode uri=" + this._uri + " ! audioconvert ! audio/x-raw,channels=2 ! level name=level interval=100000000 post-messages=true ! fakesink qos=false");
        this._level = this.pipeline.get_by_name("level");
        let decode = this.pipeline.get_by_name("decode");
        let bus = this.pipeline.get_bus();
        bus.add_signal_watch();

        this.nSamples = Math.ceil(this.duration / SAMPLE_DURATION);


        bus.connect("message", (bus, message) => {

            if (message != null) {
                this._messageCb(message);
            }
        });
    }

    _messageCb(message) {
        switch(message.type) {
            case Gst.MessageType.ELEMENT:
                let messageStructure = message.get_structure();
                if (messageStructure && messageStructure.has_name("level")) {
                    let peakVal = messageStructure.get_value("peak");
                    if (peakVal) {
                        let val = peakVal.get_nth(0);

                        if (val > 0)
                            val = 0;

                        let value = Math.pow(10, val/20);
                        peaks.push(value);
                    }
                }
                if (peaks.length == this.playTime || peaks.length == pauseVal) {
                    this.pipeline.set_state(Gst.State.PAUSED);
                }
            break;

            case Gst.MessageType.EOS:
                this.stopGeneration();
            break;
        }
    }

    startGeneration() {
        this.pipeline.set_state(Gst.State.PLAYING);
    }

    stopGeneration() {
        this.pipeline.set_state(Gst.State.NULL);

    }

    fillSurface(cr) {
        let start = 0;

        if (this.waveType == WaveType.PLAY) {

            if (peaks.length != this.playTime) {
                this.pipeline.set_state(Gst.State.PLAYING);
            }
            start = Math.floor(this.playTime);
        } else {
            if (this.recordTime >= 0) {
                start = this.recordTime;
            } else {
              return
            }
        }

        let i = 0;
        let xAxis = 0;
        let end = start + 40;
        let width = this.get_allocated_width();
        let waveheight = this.get_allocated_height();
        let length = this.nSamples;
        log(`Samples are good : ${length}`)
        let pixelsPerSample = width/waveSamples;
        let gradient = new Cairo.LinearGradient(0, 0, width , waveheight);
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
        log(`Start ${start} end ${end}`)
        for(i=0; i < peaks.length; i++) {
            // Keep moving until we get to a non-null array member
            if (peaks[i] < 0) {
                cr.moveTo((xAxis * pixelsPerSample), (waveheight - (peaks[i] * waveheight)))
            }

            // Start drawing when we reach the first non-null array member
            if (peaks[i] != null && peaks[i] >= 0) {


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
    }

    _drawEvent(playTime, recPeaks) {
        log(`play time ${playTime}, recPeaks ${recPeaks}`)
        let lastTime;
        if (this.waveType == WaveType.PLAY) {
            lastTime = this.playTime;
            log(playTime)
            this.playTime = playTime;

            if (peaks.length < this.playTime) {
                this.pipeline.set_state(Gst.State.PLAYING);
            }

            if (lastTime != this.playTime) {
                this.queue_draw();
            }

        } else {
            peaks.push(recPeaks);
            lastTime = this.recordTime;
            this.recordTime = playTime;

            if (peaks.length < this.recordTime) {
                log("error");
                return true;
            }
            this.queue_draw();
        }
        return true;
    }

    clearDrawing() {

    }

    endDrawing() {
        if (this.pipeline)
            this.stopGeneration();

        this.count = 0;
        peaks.length = 0;
    }
});
