/* exported displayDateTime formatTime */
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
 * Author: Meg Ford <megford@gnome.org>
 *
 */
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;

var formatTime = totalSeconds => {
    totalSeconds = Math.floor(totalSeconds);
    const hours = parseInt(totalSeconds / Math.pow(60, 2)).toString();
    const minutes = (parseInt(totalSeconds / 60) % 60).toString();
    const seconds = parseInt(totalSeconds % 60).toString();

    return `${hours.padStart(2, '0')}∶${minutes.padStart(2, '0')}∶${seconds.padStart(2, '0')}`;
};

var displayDateTime = time => {
    const DAY = 86400000000;
    const now = GLib.DateTime.new_now_local();
    const difference = now.difference(time);

    const days = Math.floor(difference / DAY);
    const weeks = Math.floor(difference / (7 * DAY));
    const months = Math.floor(difference / (30 * DAY));
    const years = Math.floor(difference / (365 * DAY));

    if (difference < DAY)
        return time.format('%X');
    else if (difference < 2 * DAY)
        return _('Yesterday');
    else if (difference < 7 * DAY)
        return Gettext.ngettext('%d day ago', '%d days ago', days).format(days);
    else if (difference < 14 * DAY)
        return _('Last week');
    else if (difference < 28 * DAY)
        return Gettext.ngettext('%d week ago', '%d weeks ago',  weeks).format(weeks);
    else if (difference < 60 * DAY)
        return _('Last month');
    else if (difference < 360 * DAY)
        return Gettext.ngettext('%d month ago', '%d months ago', months).format(months);
    else if (difference < 730 * DAY)
        return _('Last year');

    return Gettext.ngettext('%d year ago', '%d years ago', years).format(years);
};
