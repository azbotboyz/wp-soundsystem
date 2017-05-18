<?php
class WP_SoundSytem_Playlist_Spotify_Playlist_Api extends WP_SoundSytem_Playlist_Scraper_Preset{

    //TO FIX is limited to 100 tracks.  Find a way to get more.
    //https://developer.spotify.com/web-api/console/get-playlist-tracks
    
    var $remote_slug = 'spotify-playlist';
    
    var $pattern = '~^https?://(?:open|play).spotify.com/user/([^/]+)/playlist/([^/]+)/?$~i';
    var $redirect_url = 'https://api.spotify.com/v1/users/%spotify-user%/playlists/%spotify-playlist%/tracks';
    var $variables = array(
        'spotify-user' => null,
        'spotify-playlist' => null
    );
    
    var $token = null;

    var $options = array(
        'selectors' => array(
            'tracks'           => array('path'=>'root > items'),
            'track_artist'     => array('path'=>'track > artists > name'),
            'track_album'      => array('path'=>'track > album > name'),
            'track_title'      => array('path'=>'track > name'),
        )
    );

    function __construct(){
        parent::__construct();

        $this->remote_name = __('Spotify Playlist','wpsstm');
        $this->tracks_per_page = 100;

        $client_id = wpsstm()->get_options('spotify_client_id');
        $client_secret = wpsstm()->get_options('spotify_client_secret');
        
        if ( !$client_id || !$client_secret ){
            $this->can_use_preset = false;
        }
    }
    
    function get_tracklist_title(){
        if ( !$user_id = $this->get_variable_value('spotify-user') ) return;
        if ( !$playlist_id = $this->get_variable_value('spotify-playlist') ) return;
        
        $response = wp_remote_get( sprintf('https://api.spotify.com/v1/users/%s/playlists/%s',$user_id,$playlist_id), $this->get_request_args() );
        
        $json = wp_remote_retrieve_body($response);
        
        if ( is_wp_error($json) ) return $json;
        
        $api = json_decode($json,true);
        
        return wpsstm_get_array_value('name', $api);
    }
    
    function get_tracklist_author(){
        return $this->get_variable_value('spotify-user');
    }
    
    function get_total_tracks(){
        if ( !$user_id = $this->get_variable_value('spotify-user') ) return;
        if ( !$playlist_id = $this->get_variable_value('spotify-playlist') ) return;
        
        $response = wp_remote_get( sprintf('https://api.spotify.com/v1/users/%s/playlists/%s',$user_id,$playlist_id), $this->get_request_args() );
        
        $json = wp_remote_retrieve_body($response);
        
        if ( is_wp_error($json) ) return $json;
        
        $api = json_decode($json,true);

        return wpsstm_get_array_value(array('tracks','total'), $api);
    }
    
    function get_request_args(){
        $args = parent::get_request_args();

        if ( $token = $this->get_access_token() ){

            $args['headers']['Authorization'] = 'Bearer ' . $token;
            $this->set_variable_value('spotify-token',$token);
            
        }
        
        $args['headers']['Accept'] = 'application/json';

        return $args;
    }

    function get_access_token(){
        
        if ($this->token === null){
            
            $this->token = false;
            
            $client_id = wpsstm()->get_options('spotify_client_id');
            $client_secret = wpsstm()->get_options('spotify_client_secret');

            $args = array(
                'headers'   => array(
                    'Authorization' => 'Basic '.base64_encode($client_id.':'.$client_secret)
                ),
                'body'      => array(
                    'grant_type'    => 'client_credentials'
                )
            );


            $response = wp_remote_post( 'https://accounts.spotify.com/api/token', $args );

            if ( is_wp_error($response) ){
                wpsstm()->debug_log($response->get_error_message(),'Spotify preset error' ); 
            }
            $body = wp_remote_retrieve_body($response);
            $body = json_decode($body);
            $this->token = $body->access_token;
            
        }
        
        return $this->token;

    }
    
}