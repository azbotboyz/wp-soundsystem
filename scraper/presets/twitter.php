<?php
class WP_SoundSytem_Playlist_Twitter_Scraper extends WP_SoundSytem_Playlist_Scraper_Preset{
    var $remote_slug = 'twitter';
    
    var $pattern = '~^https?://(?:(?:www|mobile).)?twitter.com/([^/]+)/?$~i';
    var $redirect_url= 'https://mobile.twitter.com/%twitter-username%';
    var $variables = array(
        'twitter-username' => null
    );
    var $options = array(
        'selectors' => array(
            'tracks'            => array('path'=>'#main_content .timeline .tweet .tweet-text div')
        )
    );
    
    var $wizard_suggest = false; //Prefills the wizard but is not able to get a tracklist by itself, so don't populate frontend.

    function __construct(){
        parent::__construct();

        $this->remote_name = __('Twitter','wpsstm');

    }
    
    function get_request_args(){
        $args = parent::get_request_args();

        //it seems that the request fails with our default user agent, remove it.
        $args['headers']['User-Agent'] = '';

        return $args;
    }

}