'use strict';

var chalk = require('chalk');
var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var es6ify = require('es6ify');
var runSequence = require('run-sequence');
var argv = require('yargs').argv;
var browserSync = require('browser-sync').create();
var reload = browserSync.reload;
require('web-component-tester').gulp.init(gulp);

var opt = {};
opt.srcDir = argv.srcDir || 'src';
opt.tempDir = argv.tempDir || '.tmp';
opt.distDir = argv.distDir || 'dist';
opt.testDir = argv.testDir || 'test';
opt.indexFile = argv.index || 'example.html';
opt.compileEnv = argv.env || process.env.NODE_ENV || 'development'; //'development' || 'production'
opt.transpiler = argv.transpiler || 'es6ify'; //'babelify' || 'es6ify'
opt.minifyHtml = argv.minifyHtml || argv.minify || (opt.compileEnv === 'production');
opt.minifyScript = argv.minifyScript || argv.minify || (opt.compileEnv === 'production');
opt.minifyCss = argv.minifyCss || argv.minify || (opt.compileEnv === 'production');
opt.inlineScript = argv.inlineScript || (opt.compileEnv === 'production');
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
 * CLEAN:TEMP
 */
gulp.task('clean:temp', function () {
    return gulp.src([ opt.tempDir ], { read: false })
        .pipe($.plumber())
        .pipe($.clean());
});

/**
 * CLEAN:DIST
 */
gulp.task('clean:dist', function () {
    return gulp.src([ opt.distDir ], { read: false })
        .pipe($.plumber())
        .pipe($.clean());
});

/**
 * CLEAN
 */
gulp.task('clean', function (callback) {
    return runSequence([ 'clean:temp', 'clean:dist' ], callback);
});


/**
 * COPY:HTML
 */
gulp.task('copy:html', function () {
    return gulp.src(opt.srcDir + '/**/*.html')
        .pipe($.plumber())
        .pipe(gulp.dest(opt.tempDir));
});


/**
 * COPY:RESOURCE
 */
gulp.task('copy:resource', function () {
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
 * VULCANIZE:HTML
 */
gulp.task('vulcanize:html', function () {
    var injects = gulp.src([ es6ify.runtime ], { read: false });

    return gulp.src(opt.tempDir + '/*.html')
        .pipe($.plumber())
        .pipe($.inject(injects))
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
        .pipe(gulp.dest('./dist'));
});


/**
 * BUILD:JS
 */
gulp.task('build:js', function () {
    return gulp.src(opt.srcDir + '/**/*.js')
        .pipe($.plumber())
        .pipe($.eslint())
        .pipe($.eslint.format())
        .pipe($.if(opt.transpiler === 'babelify', $.browserify({
            debug:     opt.generateSourceMap,
            transform: [ 'babelify' ]
        })))
        .pipe($.if(opt.transpiler === 'es6ify', $.browserify({
            debug:     opt.generateSourceMap,
            transform: [ 'es6ify' ]
        })))
        .pipe($.if(opt.generateSourceMap, $.sourcemaps.init({ loadMaps: true })))
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
 * BUILD:HTML
 */
gulp.task('build:html', function (callback) {
    return runSequence('copy:html', 'vulcanize:html', 'clean:temp', callback);
});


/**
 * BUILD:ALL
 */
gulp.task('build:all', function (callback) {
    return runSequence('clean', 'copy:resource', [ 'build:js', 'build:css' ], 'build:html', 'test:local', callback);
});


/*
 * SERVE
 */
gulp.task('serve', [ 'build:all' ], function () {
    browserSync.init({
        server: {
            baseDir: './',
            index:   opt.indexFile
        }
    });

    var watchList = [ opt.distDir + '/*.html', opt.distDir + '/*.js', opt.distDir + '/*.css' ];
    gulp.watch(watchList).on('change', reload);
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
