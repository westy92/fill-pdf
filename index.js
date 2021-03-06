var fs    = require('fs'),
    path  = require('path'),
    exec  = require('child_process').exec,
    spawn = require('child_process').spawn,
    temp  = require('temp');

exports.generateFdf = function(data) {
  var header, body, footer, dataKeys;

  // We should really come up with a new way of making FDF files, this is doing a lot of buffer instantiation.

  header = new Buffer("%FDF-1.2\n\u00e2\u00e3\u00cf\u00d3\n1 0 obj \n<<\n/FDF \n<<\n/Fields [\n");

  footer = new Buffer("]\n>>\n>>\nendobj \ntrailer\n\n<<\n/Root 1 0 R\n>>\n%%EOF\n");

  dataKeys = Object.keys(data);

  body = new Buffer([]);

  for(var i=0; i<dataKeys.length; i++) {
    var name = dataKeys[i].toString();
    var value = data[name].toString().replace("\r\n","\r");

    body = Buffer.concat([ body, new Buffer("<<\n/T (" + name + ")\n/V (" + value + ")\n>>\n") ]);
  }

  var fdf =  Buffer.concat([ header, body, footer ]);
  return fdf;
}

exports.generatePdf = function(data, templatePath, extendArgs, callback) {
  var tempName       = temp.path({suffix: '.pdf'}),
      tempNameResult = temp.path({suffix: '.pdf'}),
      pdfPath        = isAbsolute(templatePath) ? templatePath : path.join(__dirname, templatePath);

  // Check if extendArgs is our callback, adds backwards compat
  if (typeof extendArgs === 'function') {
   callback = extendArgs;
   extendArgs = [];
  }
  else if (extendArgs instanceof Array) {
    args = extendArgs;
  }
  else {
    extendArgs = [];
  }

  var processArgs = [pdfPath, "fill_form", "-", "output", tempName].concat(extendArgs);

  child = spawn("pdftk", processArgs);

  child.on('exit', function(code) {

    // If a exit code besides 0 was thrown then send an error
    if ( code ) {
      callback(new Error('Non 0 exit code from pdftk spawn: ' + code));
    }

    // Is GhostScript necessary for this module?
    exec("gs -dNOCACHE -sDEVICE=pdfwrite -sOutputFile="+tempNameResult +" -dbatch -dNOPAUSE -dQUIET  " + tempName +"  -c quit",
      function (error, stdout, stderr) {

        // Check if Error thrown from exec
        if (error) {
          console.error('exec error: ' + error + '\n' + stderr);
          return callback(error);
        }

        if ( stderr ) {
          console.error('stderr: ' + stderr);
          return callback(stderr);
        }


        // Async read tempfile, we should think about making this a stream instead of a read into memory.
        fs.readFile(tempNameResult, function(err, filledPdf) {

          if ( err ) {
            return callback(err);
          }

          // Delete files, doing nested callbacks for now, but lets look into maybe using async for this
          fs.unlink(tempName, function(err) {
            if ( err ) {
              return callback(err);
            }

            fs.unlink(tempNameResult, function(err) {
              if ( err ) {
                return callback(err);
              }

              // Everything Looks good, send back pdfFile.
              callback(null, filledPdf);
            });
          })
        });
     });
   });

  // Write FDF file to pdftk spawned process
  child.stdin.write(exports.generateFdf(data));
  child.stdin.end();

  child.on('error', function (err) {
    callback(err);
  });

  child.stderr.on('data', function (data) {
    console.error('stderr: ' + data);
  });

}

function isAbsolute(Path) {
    return (path.isAbsolute && path.isAbsolute(Path)) || (path.normalize(Path + '/') === path.normalize(path.resolve(Path) + '/'));
};
