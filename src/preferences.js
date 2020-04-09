/* exported Preferences */
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
* Author: Meg Ford <megford@gnome.org>
*
*/

const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

var EncodingProfile = imports.encodingProfile.EncodingProfile;


let _settings = new Gio.Settings({ schema: pkg.name });

var settings = {
    get encodingProfile() {
        return _settings.get_int('media-type-preset');
    },

    set encodingProfile(profile) {
        _settings.get_int('media-type-preset', profile);
    },

    get channel() {
        return _settings.get_int('channel');
    },

    set channel(channel) {
        _settings.set_int('channel', channel);
    },

    get micVolume() {
        return _settings.get_double('mic-volume');
    },

    set micVolume(level) {
        _settings.set_double('mic-volume', level);
    },

    get speakerVolume() {
        return _settings.get_double('speaker-volume');
    },

    set speakerVolume(level) {
        _settings.set_double('speaker-volume', level);
    },
};

var SettingsDialog = GObject.registerClass({ // eslint-disable-line no-unused-vars
    Template: 'resource:///org/gnome/SoundRecorder/ui/preferences.ui',
    InternalChildren: ['formateComboBox', 'channelsComboBox', 'volumeScale', 'microphoneScale'],
}, class SettingsDialog extends Gtk.Dialog {
    _init() {
        super._init({ transient_for: Gio.Application.get_default().get_active_window() });

        this.connect('response', () => {
            this.destroy();
        });




        Object.values(EncodingProfile.Profiles).forEach(profile => {
            let index = profile.index.toString();
            this._formateComboBox.append(index, profile.name);
        });
        this._formateComboBox.set_active(settings.encodingProfile);
        this._formateComboBox.connect('changed', () => {
            settings.encodingProfile = this._formateComboBox.get_active();
        });

        this._channelsComboBox.set_active(settings.channel);
        this._channelsComboBox.connect('changed', () => {
            settings.channel = this._channelsComboBox.get_active();
        });

        this._volumeScale.set_value(settings.speakerVolume);
        this._volumeScale.connect('value-changed', () => {
            let vol = this._volumeScale.get_value();
            settings.speakerVolume = vol;
        });

        this._microphoneScale.set_value(settings.micVolume);
        this._microphoneScale.connect('value-changed', () => {
            let vol = this._microphoneScale.get_value();
            settings.micVolume = vol;
        });
    }
});
