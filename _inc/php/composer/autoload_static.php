<?php

// autoload_static.php @generated by Composer

namespace Composer\Autoload;

class ComposerStaticInit9c5a9ed12772223d3e336664965dfd77
{
    public static $files = array (
        'e9b046393eb3376a21bcc1a30bd2fe64' => __DIR__ . '/..' . '/querypath/querypath/src/qp_functions.php',
    );

    public static $prefixLengthsPsr4 = array (
        'T' => 
        array (
            'Tests\\' => 6,
        ),
        'M' => 
        array (
            'Masterminds\\' => 12,
        ),
        'L' => 
        array (
            'LastFmApi\\' => 10,
        ),
    );

    public static $prefixDirsPsr4 = array (
        'Tests\\' => 
        array (
            0 => __DIR__ . '/..' . '/matto1990/lastfm-api/tests',
        ),
        'Masterminds\\' => 
        array (
            0 => __DIR__ . '/..' . '/masterminds/html5/src',
        ),
        'LastFmApi\\' => 
        array (
            0 => __DIR__ . '/..' . '/matto1990/lastfm-api/src/lastfmapi',
        ),
    );

    public static $prefixesPsr0 = array (
        'Q' => 
        array (
            'QueryPath' => 
            array (
                0 => __DIR__ . '/..' . '/querypath/querypath/src',
            ),
        ),
        'F' => 
        array (
            'ForceUTF8\\' => 
            array (
                0 => __DIR__ . '/..' . '/neitanod/forceutf8/src',
            ),
        ),
    );

    public static function getInitializer(ClassLoader $loader)
    {
        return \Closure::bind(function () use ($loader) {
            $loader->prefixLengthsPsr4 = ComposerStaticInit9c5a9ed12772223d3e336664965dfd77::$prefixLengthsPsr4;
            $loader->prefixDirsPsr4 = ComposerStaticInit9c5a9ed12772223d3e336664965dfd77::$prefixDirsPsr4;
            $loader->prefixesPsr0 = ComposerStaticInit9c5a9ed12772223d3e336664965dfd77::$prefixesPsr0;

        }, null, ClassLoader::class);
    }
}