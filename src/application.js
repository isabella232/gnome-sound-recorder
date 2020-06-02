/* exported application settings Application */
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
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gst = imports.gi.Gst;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;

const MainWindow = imports.mainWindow;

var application = null;

var settings = new Gio.Settings({ schema: pkg.name });

var Application = GObject.registerClass(class Application extends Gtk.Application {
    _init() {
        super._init({ application_id: pkg.name });
        GLib.set_application_name(_('Sound Recorder'));
        GLib.set_prgname('gnome-sound-recorder');
        GLib.setenv('PULSE_PROP_media.role', 'production', 1);
        GLib.setenv('PULSE_PROP_application.icon_name', pkg.name, 1);

        this.add_main_option('version', 'v'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE,
            'Print version information and exit', null);

        this.connect('handle-local-options', (app, options) => {
            if (options.contains('version')) {
                print(pkg.version);
                /* quit the invoked process after printing the version number
                 * leaving the running instance unaffected
                 */
                return 0;
            }
            return -1;
        });
    }

    _initAppMenu() {
        function getDefaultProfile() {
            switch (settings.get_enum('audio-profile')) {
            case 0:
                return new GLib.Variant('s', 'vorbis');
            case 1:
                return new GLib.Variant('s', 'opus');
            case 2:
                return new GLib.Variant('s', 'flac');
            case 3:
                return new GLib.Variant('s', 'mp3');
            case 4:
                return new GLib.Variant('s', 'm4a');
            }
        }

        let profileAction = new Gio.SimpleAction({
            enabled: true,
            name: 'audio-profile',
            state: getDefaultProfile(),
            parameter_type: new GLib.VariantType('s'),
        });
        profileAction.connect('activate', (action, parameter) => {
            action.change_state(parameter);
        });
        profileAction.connect('change-state', (action, state) => {
            settings.set_value('audio-profile', state);
        });
        settings.connect('changed::audio-profile', () => {
            profileAction.state = getDefaultProfile();
        });
        this.add_action(profileAction);


        let aboutAction = new Gio.SimpleAction({ name: 'about' });
        aboutAction.connect('activate', () => {
            this._showAbout();
        });
        this.add_action(aboutAction);

        let quitAction = new Gio.SimpleAction({ name: 'quit' });
        quitAction.connect('activate', () => {
            this.quit();
        });
        this.add_action(quitAction);
        this.add_accelerator('<Primary>q', 'app.quit', null);
    }

    vfunc_startup() {
        super.vfunc_startup();

        this._loadStyleSheet();
        log(_('Sound Recorder started'));
        Gst.init(null);
        this._initAppMenu();
        application = this;
        this.ensureDirectory();
    }

    ensureDirectory() {
        /* Translators: "Recordings" here refers to the name of the directory where the application places files */
        let path = GLib.build_filenamev([GLib.get_home_dir(), _('Recordings')]);

        // Ensure Recordings directory
        GLib.mkdir_with_parents(path, 0o0755);
        this.saveDir = Gio.file_new_for_path(path);
    }

    vfunc_activate() {
        (this.window = new MainWindow.MainWindow({ application: this })).show();
        if (pkg.name.endsWith('Devel'))
            this.window.get_style_context().add_class('devel');
    }

    _loadStyleSheet() {
        let provider = new Gtk.CssProvider();
        provider.load_from_resource('/org/gnome/SoundRecorder/application.css');
        Gtk.StyleContext.add_provider_for_screen(Gdk.Screen.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
    }

    _showAbout() {
        let aboutDialog = new Gtk.AboutDialog({
            artists: ['Reda Lazri <the.red.shortcut@gmail.com>',
                'Garrett LeSage <garrettl@gmail.com>',
                'Hylke Bons <hylkebons@gmail.com>',
                'Sam Hewitt <hewittsamuel@gmail.com>'],
            authors: ['Meg Ford <megford@gnome.org>'],
            /* Translators: Replace "translator-credits" with your names, one name per line */
            translator_credits: _('translator-credits'),
            program_name: GLib.get_application_name(),
            comments: _('A Sound Recording Application for GNOME'),
            license_type: Gtk.License.GPL_2_0,
            logo_icon_name: pkg.name,
            version: pkg.version,
            website: 'https://wiki.gnome.org/Apps/SoundRecorder',
            copyright: `Copyright 2013-${new Gtk.Calendar().get_date()[0]} Meg Ford`,
            wrap_license: true,
            modal: true,
            transient_for: this.window,
            use_header_bar: true,
        });
        aboutDialog.show();
        aboutDialog.connect('response', () => {
            aboutDialog.destroy();
        });
    }
});
