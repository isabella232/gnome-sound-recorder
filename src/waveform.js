
/* exported WaveForm
/*
 * Copyright 2013 Meg Ford
             2020 Kavan Mevada
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
 *          Kavan Mevada <kavanmevada@gmail.com>
 *
 */

// based on code from Pitivi

const { GObject, Gtk } = imports.gi;
const Cairo = imports.cairo;

const GUTTER = 4;

var WaveForm = GObject.registerClass({
    Properties: {
        'peak': GObject.ParamSpec.float(
            'peak',
            'Waveform current peak', 'Waveform current peak in float [0, 1]',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
            0.0, 1.0, 0.0),
    },
}, class WaveForm extends Gtk.DrawingArea {
    _init() {
        this.peaks = [];
        super._init({
            vexpand: true,
            valign: Gtk.Align.FILL,
        });
        this.show();
    }

    vfunc_draw(ctx) {
        const maxHeight = this.get_allocated_height();
        const vertiCenter = maxHeight / 2;
        const horizCenter = this.get_allocated_width() / 2;

        let pointer = horizCenter;

        ctx.setLineCap(Cairo.LineCap.ROUND);
        ctx.setLineWidth(2);
        ctx.setSourceRGBA(255, 0, 0, 1);

        ctx.moveTo(horizCenter, vertiCenter - maxHeight);
        ctx.lineTo(horizCenter, vertiCenter + maxHeight);
        ctx.stroke();

        ctx.setLineWidth(1);
        ctx.setSourceRGBA(0, 0, 0, 1);
        for (let index = this.peaks.length; index > 0; index--) {
            const peak = this.peaks[index];

            ctx.moveTo(pointer, vertiCenter + peak * maxHeight);
            ctx.lineTo(pointer, vertiCenter - peak * maxHeight);
            ctx.stroke();

            pointer -= GUTTER;
        }
    }

    set peak(p) {
        if (this.peaks.length > this.get_allocated_width() / (2 * GUTTER))
            this.peaks.shift();

        this.peaks.push(p.toFixed(2));
        this.queue_draw();
    }

    destroy() {
        this.peaks.length = 0;
        this.queue_draw();
    }
});
