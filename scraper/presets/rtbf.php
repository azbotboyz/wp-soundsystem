<?php
class WP_SoundSytem_Playlist_RTBF_Scraper extends WP_SoundSytem_Playlist_Scraper_Preset{
    var $slug = 'rtbf';
    
    var $pattern = '~^https?://(?:www.)?rtbf.be/(?!lapremiere)([^/]+)~i'; //ignore la premiere which has different selectors.
    var $redirect_url= 'https://www.rtbf.be/%rtbf-slug%/conducteur';
    var $variables = array(
        'rtbf-slug' => null
    );
    var $options = array(
        'selectors' => array(
            'tracks'            => array('path'=>'li.radio-thread__entry'),
            'track_artist'      => array('path'=>'span[itemprop="byArtist"]'),
            'track_title'       => array('path'=>'span[itemprop="name"]'),
            'track_image'       => array('path'=>'img[itemprop="inAlbum"]','attr'=>'data-src')
        )
    );
    
    var $wizard_suggest = false;

    function __construct(){
        parent::__construct();

        $this->name = __('RTBF radios','wpsstm');

    } 

}