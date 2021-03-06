(function () {
    var webupload = {};
    PARALLEL_BATCH_SIZE = 4;

    function global_status(cfg) {
        this.progress = cfg.progress;
        this.last = cfg.last;
        this.batch_size = cfg.batch_size || PARALLEL_BATCH_SIZE;
    };

    function xhr_context(cfg) {
        this.status = cfg.status;
        this.files = cfg.files;
        this.serial = cfg.serial;
        this.cur_idx = cfg.cur_idx;
        this.use_chunk = cfg.use_chunk;
        // the maximum 'Content-Length' accepted by server.
        // nginx default client_max_body_size size is 1MB
        this.chunk_size = cfg.chunk_size || 1024 * 1024;
        this.slice = {
            start: 0,
            end: 0
        };
    }

    webupload.print_files = function (evt) {
        var file_list = document.getElementById('file_input').files;
        document.getElementById("uploaded_files").innerHTML = "0/" + file_list.length;
        var info =
            '<table><tr><th>file name</th><th>size</th><th>type</th><th>progress</th></tr>';
        for (var i = 0, file; file = file_list[i]; i++) {
            var file_size = "";
            if (file.size > 1024 * 1024) {
                file_size = (file.size / 1024 / 1024).toFixed(2) + 'MB';
            } else {
                file_size = (file.size / 1024).toFixed(2) + 'KB';
            }
            info += '<tr><td>' + file.name + '<td>' + file_size + '<td>' + file.type + '<td id=file_id_' + i + '>Waiting</td></tr>';
        }
        info += '</table>';
        document.getElementById('file_info').innerHTML = info;
    }

    function upload_one(xhr_ctx) {
        var xhr = new XMLHttpRequest();

        // when uploading whole file instead of slicing, use this event to
        // update the progress.
        if (!xhr_ctx.use_chunk) {
            xhr.upload.addEventListener("progress", function (evt) {
                var idx = xhr_ctx.cur_idx;
                document.getElementById("file_id_" + idx).innerHTML = (evt.loaded * 100 / evt.total).toFixed(2) + '%';
            });
        }

        // upload complete.
        xhr.addEventListener("load", function (evt) {
            var idx = xhr_ctx.cur_idx;
            var slice = xhr_ctx.slice;
            if (xhr_ctx.use_chunk && (slice.end < file.size)) {
                document.getElementById('file_id_' + idx).innerHTML = (slice.end * 100 / file.size).toFixed(2) + '%';

                xhr_ctx.slice.start = slice.end;
                upload_one(xhr_ctx);
            } else {
                document.getElementById('file_id_' + idx).innerHTML = evt.target.responseText;
                var progress = document.getElementById("uploaded_files").innerHTML;
                if (!progress) {
                    document.getElementById("uploaded_files").innerHTML = "1/" + xhr_ctx.files.length;
                } else {
                    var count = parseInt(progress.split('/')[0]) + 1;
                    document.getElementById("uploaded_files").innerHTML = count + "/" + xhr_ctx.files.length;
                }

                xhr_ctx.status.progress--;
                if (xhr_ctx.status.last < (xhr_ctx.files.length - 1)) {
                    var pending = xhr_ctx.files.length - 1 - xhr_ctx.status.last;
                    pending = Math.min(pending, xhr_ctx.status.batch_size - xhr_ctx.status.progress);
                    // if serial mode, only one outstanding transfer.
                    if (xhr_ctx.serial) {
                        pending = Math.min(pending, 1);
                    }
                    for (var i = 0; i < pending; i++) {
                        xhr_ctx.status.last++;
                        xhr_ctx.cur_idx = xhr_ctx.status.last;
                        xhr_ctx.slice.start = xhr_ctx.slice.end = 0;
                        xhr_ctx.status.progress++;
                        upload_one(xhr_ctx);
                    }
                }
            }
        }, false);
        xhr.addEventListener("error", function (evt) {
            var idx = xhr_ctx.cur_idx;
            var fname = xhr_ctx.files[idx].name;
            document.getElementById('file_id_' + idx).innerHTML = 'failed to upload';
        }, false);
        xhr.addEventListener("abort", function (evt) {
            var idx = xhr_ctx.cur_idx;
            var fname = xhr_ctx.files[idx].name;
            document.getElementById('file_id_' + idx).innerHTML = 'upload aborted';
        }, false);

        var file = xhr_ctx.files[xhr_ctx.cur_idx];
        var path = window.document.location.pathname;
        if (xhr_ctx.use_chunk) {
            xhr_ctx.slice.end = Math.min(xhr_ctx.slice.start + xhr_ctx.chunk_size, file.size);
            // https://developer.mozilla.org/en-US/docs/Web/API/File
            var blob = file.slice(xhr_ctx.slice.start, xhr_ctx.slice.end);
            var nchunks = (xhr_ctx.slice.start / xhr_ctx.chunk_size);
            xhr.open("POST", path + '/' + encodeURIComponent(file.name) + '?chunk=' + nchunks.toString(16));
            xhr.send(blob);
        } else {
            xhr.open("POST", path + '/' + encodeURIComponent(file.name));
            xhr.send(file);
        }
    }

    webupload.upload_files = function (evt) {
        var file_list = document.getElementById('file_input').files;
        var parallel = document.getElementById('multi_xhr').checked;
        var chunk = document.getElementById('use_chunk').checked;
        var bsize = 5;

        document.getElementById("uploaded_files").innerHTML = "0/" + file_list.length;

        var status = new global_status({
            progress: 1,
            last: 0,
            batch_size: bsize
        });

        if (parallel) {
            var nprogress = Math.min(file_list.length, status.batch_size);
            for (var i = 0; i < nprogress; i++) {
                status.last = i;
                status.progress = nprogress;
                var ctx = new xhr_context({
                    files: file_list,
                    cur_idx: i,
                    use_chunk: chunk,
                    status: status,
                    serial: false
                });
                upload_one(ctx);
            }
        } else {
            var ctx = new xhr_context({
                files: file_list,
                cur_idx: 0,
                use_chunk: chunk,
                status: status,
                serial: true
            });
            upload_one(ctx);
        }
    }

    // export namespace.
    window.webupload = webupload;
})();

document.getElementById('file_input').onchange = webupload.print_files;
document.getElementById('upload_btn').onclick = webupload.upload_files;