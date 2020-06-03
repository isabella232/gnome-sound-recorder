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

const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Cairo = imports.cairo;

const WAVE_SAMPLES = 40;

var WaveForm = GObject.registerClass({
    GTypeName: 'WaveForm',
}, class WaveForm extends Gtk.DrawingArea {

    _init() {
        super._init({});
        this.peaks = [];

        this.set_property('vexpand', true);
        this.set_property('valign', Gtk.Align.FILL);
        this.show();
    }

    vfunc_draw(cr) {
        let xAxis = 0;
        let start = this.recordedTime;
        let end = start + WAVE_SAMPLES;
        let width = this.get_allocated_width();
        let height = this.get_allocated_height();
        let pixelsPerSample = width / WAVE_SAMPLES;
        let gradient = new Cairo.LinearGradient(0, 0, width, height);

        gradient.addColorStopRGBA(0.75, 0.0, 0.72, 0.64, 0.35);
        gradient.addColorStopRGBA(0.0, 0.2, 0.54, 0.47, 0.22);
        cr.setLineWidth(1);
        cr.setSourceRGBA(0.0, 185, 161, 255);

        for (let i = start; i <= end; i++) {

            // Keep moving until we get to a non-null array member
            if (this.peaks[i] && this.peaks[i] < 0)
                cr.moveTo(xAxis * pixelsPerSample, height - this.peaks[i] * height);


            // Start drawing when we reach the first non-null array member
            if (this.peaks[i] && this.peaks[i] >= 0) {

                if (start >= WAVE_SAMPLES && xAxis === 0)
                    cr.moveTo(xAxis * pixelsPerSample, height);

                cr.lineTo(xAxis * pixelsPerSample, height - this.peaks[i] * height);
            }

            xAxis += 1;
        }


        cr.lineTo(xAxis * pixelsPerSample, height);
        cr.closePath();
        cr.strokePreserve();
        cr.setSource(gradient);
        cr.fillPreserve();
        cr.$dispose();
    }

    _drawEvent(time, peak) {
        // Reset on Time = 0
        if (time === 0)
            this.peaks = Array(WAVE_SAMPLES).fill(-this.get_allocated_height());

        this.peaks.push(peak);
        this.recordedTime = time;
        this.queue_draw();
    }

    endDrawing() {
        this.recordedTime = 0;
        this.peaks.length = 0;
        this.queue_draw();
    }

});
