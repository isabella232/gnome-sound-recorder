/* exported RecordingsListBox */
const { GObject, Gtk } = imports.gi;
const { Row, RowState } = imports.row;

var RecordingsListBox = new GObject.registerClass(class RecordingsListBox extends Gtk.ListBox {
    _init(model, player) {
        super._init({
            valign: Gtk.Align.FILL,
            margin_left: 8,
            margin_right: 8,
            margin_top: 12,
            margin_bottom: 12,
            activate_on_single_click: true,
        });

        this.get_style_context().add_class('preferences');

        this.bind_model(model, recording => {
            let row = new Row(recording);

            row.connect('play', _row => {
                if (this.activePlayingRow && this.activePlayingRow !== _row)
                    this.activePlayingRow.setState(RowState.PAUSED);

                player.play(recording.uri);

                if (!this.activePlayingRow || this.activePlayingRow !== _row)
                    this.activePlayingRow = _row;
            });

            row.connect('pause', () => player.pause());

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
        if (this.activeRow)
            this.activeRow._revealer.reveal_child = false;

        row._revealer.reveal_child = !row._revealer.reveal_child;

        if (!this.activeRow || this.activeRow !== row)
            this.activeRow = row;
    }

});
