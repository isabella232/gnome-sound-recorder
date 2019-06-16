/* exported getDisplayTime */
/*
 * Copyright 2013 Meg Ford
 * Copyright (c) 2013 Giovanni Campagna <scampa.giovanni@gmail.com>
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
 * Author: Meg Ford <megford@gnome.org>
 *
 */
 // -*- Mode: js; indent-tabs-mode: nil; c-basic-offset: 4; tab-width: 4 -*-

const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;


const Gettext = imports.gettext;
const _ = imports.gettext.gettext;


var getDisplayTime = function (mtime) {
    let text = "";
    let DAY = 86400000000;
    let now = GLib.DateTime.new_now_local();
    let difference = now.difference(mtime);
    let days = Math.floor(difference / DAY);
    let weeks = Math.floor(difference / (7 * DAY));
    let months = Math.floor(difference / (30 * DAY));
    let years = Math.floor(difference / (365 * DAY));

    if (difference < DAY) {
        let time = mtime.format('%X');
        text = _(`Today, ${time}`);
    } else if (difference < 2 * DAY) {
        text = _("Yesterday");
    } else if (difference < 7 * DAY) {
        text = Gettext.ngettext("%d day ago",
                                "%d days ago",
                                 days).format(days);
    } else if (difference < 14 * DAY) {
        text = _("Last week");
    } else if (difference < 28 * DAY) {
        text = Gettext.ngettext("%d week ago",
                                 "%d weeks ago",
                                 weeks).format(weeks);
    } else if (difference < 60 * DAY) {
        text = _("Last month");
    } else if (difference < 360 * DAY) {
        text = Gettext.ngettext("%d month ago",
                                 "%d months ago",
                                 months).format(months);
    } else if (difference < 730 * DAY) {
        text = _("Last year");
    } else {
        text = Gettext.ngettext("%d year ago",
                                "%d years ago",
                                years).format(years);
    }
    return text;
}


var getDisplayDuration = function (seconds) {
    let hoursStr = String(parseInt((seconds / 3600) % 60)).padStart(2, '0')
    let minutesStr = String(parseInt((seconds / 60) % 60)).padStart(2, '0')
    let secondsStr = String(parseInt(seconds % 60)).padStart(2, '0')
    return `${hoursStr}:${minutesStr}:${secondsStr}`;
}
