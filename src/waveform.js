
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

const { Gdk, GObject, Gtk } = imports.gi;
const Cairo = imports.cairo;

var WaveType = {
    RECORDER: 0,
    PLAYER: 1,
};

const GUTTER = 4;

var WaveForm = GObject.registerClass({
    Properties: {
        'position': GObject.ParamSpec.float(
            'position',
            'Waveform position', 'Waveform position',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
            0.0, 1.0, 0.0),
        'peak': GObject.ParamSpec.float(
            'peak',
            'Waveform current peak', 'Waveform current peak in float [0, 1]',
            GObject.ParamFlags.READWRITE | GObject.ParamFlags.CONSTRUCT,
            0.0, 1.0, 0.0),
    },
    Signals: {
        'position-changed': {  param_types: [GObject.TYPE_FLOAT]  },
    },
}, class WaveForm extends Gtk.DrawingArea {
    _init(params, type) {
        this._peaks = [];
        this._position = 0;
        this.lastPosition = 0;
        this.waveType = type;
        super._init(params);

        if (this.waveType === WaveType.PLAYER) {
            this.add_events(Gdk.EventMask.BUTTON_PRESS_MASK |
                Gdk.EventMask.BUTTON_RELEASE_MASK |
                Gdk.EventMask.BUTTON1_MOTION_MASK);
        }


        this.show();
    }

    vfunc_button_press_event(event) {
        this._startX = event.x;
        return true;
    }

    vfunc_motion_notify_event(event) {
        this._position = this._clamped(event.x - this._startX + this._lastX);
        this.queue_draw();
        return true;
    }

    vfunc_button_release_event(_) {
        this._lastX = this._position;
        this.emit('position-changed', this.position);
        return true;
    }

    vfunc_draw(ctx) {
        const maxHeight = this.get_allocated_height();
        const vertiCenter = maxHeight / 2;
        const horizCenter = this.get_allocated_width() / 2;

        let pointer = horizCenter + this._position;

        ctx.setLineCap(Cairo.LineCap.ROUND);
        ctx.setLineWidth(2);

        if (this.waveType === WaveType.PLAYER)
            ctx.setSourceRGB(28 / 255, 113 / 255, 216 / 255);
        else
            ctx.setSourceRGB(1, 0, 0);

        ctx.moveTo(horizCenter, vertiCenter - maxHeight);
        ctx.lineTo(horizCenter, vertiCenter + maxHeight);
        ctx.stroke();

        ctx.setLineWidth(1);

        this._peaks.forEach(peak => {
            if (pointer > horizCenter)
                ctx.setSourceRGB(192 / 255, 191 / 255, 188 / 255);
            else
                ctx.setSourceRGB(46 / 255, 52 / 255, 54 / 255);

            ctx.moveTo(pointer, vertiCenter + peak * maxHeight);
            ctx.lineTo(pointer, vertiCenter - peak * maxHeight);
            ctx.stroke();

            if (this.waveType === WaveType.PLAYER)
                pointer += GUTTER;
            else
                pointer -= GUTTER;
        });
    }

    set peak(p) {
        if (this._peaks.length > this.get_allocated_width() / (2 * GUTTER))
            this._peaks.pop();

        this._peaks.unshift(p.toFixed(2));
        this.queue_draw();
    }

    set peaks(p) {
        this._peaks = p;
        this.queue_draw();
    }

    set position(pos) {
        this._position = this._clamped(-pos * this._peaks.length * GUTTER);
        this._lastX = this._position;
        this.queue_draw();
        this.notify('position');
    }

    get position() {
        return -this._position / (this._peaks.length * GUTTER);
    }

    _clamped(position) {
        if (position > 0)
            position = 0;
        else if (position < -this._peaks.length * GUTTER)
            position = -this._peaks.length * GUTTER;

        return position;
    }

    destroy() {
        this._peaks.length = 0;
        this.queue_draw();
    }
});
