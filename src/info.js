/* exported InfoDialog */
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

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const Utils = imports.utils;
const EncodingProfile = imports.encodingProfile.EncodingProfile;


var InfoDialog = GObject.registerClass({ // eslint-disable-line no-unused-vars
    Template: 'resource:///org/gnome/SoundRecorder/ui/infodialog.ui',
    InternalChildren: ['cancelBtn', 'doneBtn', 'fileNameEntry', 'sourceLabel', 'dateModifiedValueLabel', 'dateCreatedLabel', 'dateCreatedValueLabel', 'mediaTypeLabel'],
}, class InfoDialog extends Gtk.Window {
    _init(recording) {
        this._file = Gio.File.new_for_uri(recording.uri);

        super._init({ transient_for: Gio.Application.get_default().get_active_window() });

        this._fileNameEntry.text = recording.name;

        // Source value
        this._sourceLabel.label = this._file.get_parent().get_path();

        if (recording.timeCreated > 0) {
            this._dateCreatedValueLabel.label = Utils.Time.getDisplayTime(recording.timeCreated);
        } else {
            this._dateCreatedValueLabel.destroy();
            this._dateCreatedLabel.destroy();
        }

        this._dateModifiedValueLabel.label = Utils.Time.getDisplayTime(recording.timeModified);
        Object.values(EncodingProfile.Profiles).forEach(profile => {
            if (profile.mimeType === recording.mimeType)
                this._mediaTypeLabel.label = profile.name;
        });

        this._cancelBtn.connect('clicked', () => {
            this.destroy();
        });

        this._doneBtn.connect('clicked', () => {
            let newFileName = this._fileNameEntry.get_text();
            this._file.set_display_name_async(newFileName, GLib.PRIORITY_DEFAULT, null, null);
            this.destroy();
        });
    }
});
