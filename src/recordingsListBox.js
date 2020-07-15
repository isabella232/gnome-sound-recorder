/* exported RecordingsListBox */
const { GObject, Gtk, Gst } = imports.gi;
const { Row, RowState } = imports.row;

var RecordingsListBox = new GObject.registerClass(class RecordingsListBox extends Gtk.ListBox {
    _init(model, player) {
        this._player = player;
        super._init({
            valign: Gtk.Align.FILL,
            margin_left: 8,
            margin_right: 8,
            margin_top: 12,
            margin_bottom: 12,
            activate_on_single_click: true,
        });

        this.get_style_context().add_class('preferences');

        this._player.connect('notify::state', _player => {
            if (_player.state === Gst.State.NULL && this.activePlayingRow)
                this.activePlayingRow.state = RowState.PAUSED;
        });

        this.bind_model(model, recording => {
            let row = new Row(recording);
            row.connect('play', _row => {
                if (this.activePlayingRow && this.activePlayingRow !== _row)
                    this.activePlayingRow.state = RowState.PAUSED;

                player.play(recording.uri);
                this.activePlayingRow = _row;
            });

            row.connect('pause', _row => {
                this._player.pause();
            });

            row.connect('seek-backward', _ => {
                player.position -= 10 * Gst.SECOND;
            });
            row.connect('seek-forward', _ => {
                player.position += 10 * Gst.SECOND;
            });

            row.connect('deleted', () => {
                if (row === this.activeRow)
                    this.activeRow = null;

                if (row === this.activePlayingRow)
                    this.activePlayingRow = null;

                model.remove(row.get_index());
            });

            return row;
        });

        this.show();
    }

    vfunc_row_activated(row) {
        if (this.activeRow && this.activeRow !== row)
            this.activeRow.expanded = false;

        row.expanded = !row.expanded;
        this.activeRow = row;
    }
});
