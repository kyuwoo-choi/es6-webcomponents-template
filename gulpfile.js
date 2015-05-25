'use strict';

var path = require('path');
var chalk = require('chalk');
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var runSequence = require('run-sequence');
var argv = require('yargs').argv;
var browserSync = require('browser-sync').create();
require('web-component-tester').gulp.init(gulp);

var opt = {};
opt.srcDir = argv.srcDir || 'src';
opt.componentDir = argv.componentDir || 'component';
opt.tempDir = argv.tempDir || '.temp';
opt.distDir = argv.distDir || 'dist';
opt.testDir = argv.testDir || 'test';
opt.indexFile = argv.index || path.join(opt.distDir, 'index.html');
opt.compileEnv = argv.env || process.env.NODE_ENV || 'development'; //'development' || 'production'
opt.transpiler = argv.transpiler || 'traceur'; //'babel' || 'traceur'
opt.minifyHtml = argv.minifyHtml || argv.minify || (opt.compileEnv === 'production');
opt.minifyScript = argv.minifyScript || argv.minify || (opt.compileEnv === 'production');
opt.minifyCss = argv.minifyCss || argv.minify || (opt.compileEnv === 'production');
opt.inlineScript = argv.inlineScript || false; //TODO vulcanize inlineScript breaks in some cases. https://github.com/Polymer/vulcanize/issues/113
opt.inlineCss = argv.inlineCss || false; //TODO vulcanize inlineCss option only works with <link rel="import" type="css> not <link rel="stylesheet"> so transform rel="stylesheet" to rel="import" first.
opt.generateSourceMap = argv.generateSourceMap || (opt.compileEnv === 'development');


(function verbose (enabledChalk, disabledChalk) {
    function write (key, value) {
        console.log((value ? enabledChalk(key + value) : disabledChalk(key + value)));
    }
    write('INDEX :              ', opt.indexFile);
    write('SRC DIR :            ', opt.srcDir);
    write('TEMP DIR :           ', opt.tempDir);
    write('DIST DIR :           ', opt.distDir);
    write('TEST DIR :           ', opt.testDir);
    write('ENV :                ', opt.compileEnv);
    write('TRANSPILER :         ', opt.transpiler);
    write('INLINE SCRIPT :      ', opt.inlineScript);
    write('INLINE CSS :         ', opt.inlineCss);
    write('MINIFY HTML :        ', opt.minifyHtml);
    write('MINIFY SCRIPT :      ', opt.minifyScript);
    write('MINIFY CSS :         ', opt.minifyCss);
    write('GENERATE SOURCEMAP : ', opt.generateSourceMap);
})(chalk.green, chalk.gray);


/**
 * CLEAN
 */
gulp.task('clean', function () {
    return gulp.src([ opt.tempDir, opt.distDir ], { read: false })
        .pipe($.plumber())
        .pipe($.clean());
});


/**
 * PREPARE:HTML
 */
gulp.task('prepare:html', function () {
    var injectFiles = [ path.join(opt.tempDir, 'bower_components', 'webcomponentsjs', 'webcomponents.js') ];
    if (opt.transpiler === 'traceur') {
        injectFiles.push(path.join(opt.tempDir, 'bower_components', 'traceur-runtime', 'traceur-runtime.js'));
    }
    return gulp.src(opt.srcDir + '/**/*.html')
        .pipe($.plumber())
        .pipe($.inject(gulp.src(injectFiles, { read: false }), {
            relative: true,
            transform: function (filepath) {
                //inject file path rewrite.
                arguments[ 0 ] = path.relative(path.resolve(opt.tempDir), path.resolve(opt.tempDir, filepath));
                return $.inject.transform.apply($.inject.transform, arguments);
            }
        }))
        .pipe(gulp.dest(opt.tempDir));
});


/**
 * PREPARE:JS
 */
gulp.task('prepare:js', function () {
    //TODO minifying bower_components js needed
    return gulp.src('bower_components/**')
        .pipe(gulp.dest(path.join(opt.tempDir, 'bower_components')))
        .pipe($.if(!opt.inlineScript, gulp.dest(path.join(opt.distDir, 'bower_components'))));
});


/**
 * PREPARE:RESOURCE
 */
gulp.task('prepare:resource', function () {
    var excludeHtmlJsCssFilter = $.filter([ '**', '!**/*.html', '!**/*.js', '!**/*.css' ]);
    var excludeFolderFilter = $.filter(function (file) {
        return file.stat.isFile();
    });

    return gulp.src(opt.srcDir + '/**')
        .pipe($.plumber())
        .pipe(excludeHtmlJsCssFilter)
        .pipe(excludeFolderFilter)
        .pipe(gulp.dest(opt.tempDir))
        .pipe(gulp.dest(opt.distDir))
        .pipe(excludeFolderFilter.restore())
        .pipe(excludeHtmlJsCssFilter.restore());
});




/**
 * BUILD:HTML
 */
gulp.task('build:html', [ 'prepare:html' ], function () {
    var injectFiles = [ path.join(opt.tempDir, 'bower_components', 'webcomponentsjs', 'webcomponents.js') ];
    if (opt.transpiler === 'traceur') {
        injectFiles.push(path.join(opt.tempDir, 'bower_components', 'traceur-runtime', 'traceur-runtime.js'));
    }
    return gulp.src(opt.tempDir + '/*.html')
        .pipe($.plumber())
        .pipe($.vulcanize({
            inlineScripts: opt.inlineScript,
            inlineCss:     opt.inlineCss
        }))
        .pipe($.htmlMinifier({
            removeComments:     opt.minifyHtml,
            collapseWhitespace: opt.minifyHtml,
            preserveLineBreaks: !opt.minifyHtml,
            minifyJS:           opt.minifyScript,
            minifyCSS:          opt.minifyCss
        }))
        .pipe(gulp.dest(opt.distDir));
});


/**
 * BUILD:JS
 */
gulp.task('build:js', [ 'prepare:js' ], function () {
    var wwwFilter = $.filter([ '**/*.js', '!lib/**/*.js' ]);

    return gulp.src(opt.srcDir + '/**/*.js')
        .pipe($.plumber())
        .pipe($.eslint())
        .pipe($.eslint.format())
        .pipe($.if(opt.generateSourceMap, $.sourcemaps.init({ loadMaps: true })))
        .pipe($.if(opt.transpiler === 'babel', $.babel()))
        .pipe($.if(opt.transpiler === 'traceur', $.traceur()))
        .pipe(wwwFilter)
        .pipe($.browserify())
        .pipe(wwwFilter.restore())
        .pipe($.if(opt.minifyScript, $.uglify()))
        .pipe($.if(opt.generateSourceMap, $.sourcemaps.write('.', {
            sourceRoot: '.'
        })))
        .pipe(gulp.dest(opt.tempDir))
        .pipe($.if((!opt.inlineScript), gulp.dest(opt.distDir)));
});


/**
 * BUILD:CSS
 */
gulp.task('build:css', function () {
    return gulp.src(opt.srcDir + '/**/*.css')
        .pipe($.plumber())
        .pipe($.if(opt.minifyCss && opt.generateSourceMap, $.sourcemaps.init({ loadMaps: true })))
        .pipe($.if(opt.minifyCss, $.minifyCss()))
        .pipe($.if(opt.minifyCss && opt.generateSourceMap, $.sourcemaps.write('.', {
            sourceRoot: '.'
        })))
        .pipe(gulp.dest(opt.tempDir))
        .pipe($.if((!opt.inlineCss), gulp.dest(opt.distDir)));
});


/**
 * BUILD:ALL
 */
gulp.task('build:all', [ 'clean' ], function (callback) {
    return runSequence([ 'prepare:resource', 'build:js', 'build:css' ], 'build:html', 'test:local', callback);
});


/*
 * SERVE
 */
gulp.task('serve', [ 'build:all' ], function () {
    var componentDir = path.join(opt.distDir, opt.componentDir);
    var watchList = [ '*.html', '*.js', '*.css',
        componentDir + '/*.html', componentDir + '/*.js', componentDir + '/*.css' ];

    browserSync.init({
        files: watchList,
        startPath: opt.indexFile,
        server: {
            baseDir: './'
        }
    });
    gulp.watch(watchList, [ 'test:local' ]);
    gulp.watch(opt.testDir + '/**/*', [ 'test:local' ]);
});


/**
 * DEFAULT
 */
gulp.task('default', [ 'serve' ], function () {
    gulp.watch(opt.srcDir + '/**/*.css', [ 'build:css' ]);
    gulp.watch(opt.srcDir + '/**/*.js', [ 'build:js' ]);
    gulp.watch(opt.srcDir + '/**/*.html', [ 'build:html' ]);
});
