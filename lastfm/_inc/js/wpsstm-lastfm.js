var toggle_scrobble_el = null;
var is_scrobbler_active = ( localStorage.getItem("wpsstm-scrobble") == 'true' ); //localStorage stores strings);

(function($){

    $(document).ready(function(){
        
        //LAST.FM : toggle scrobbling
        toggle_scrobble_el = $('#wpsstm-player-toggle-scrobble');

        if (is_scrobbler_active === null) { //default
            is_scrobbler_active = true;
        }
        
        if ( !wpsstm_is_lastfm_api_logged() ) is_scrobbler_active = false;
        
        if (is_scrobbler_active){
            toggle_scrobble_el.addClass('active');
        }

        $('#wpsstm-player-toggle-scrobble a').click(function(e) {
            e.preventDefault();
            if ( !wpsstm_is_lastfm_api_logged() ) return;
            
            var link = $(this);
            var link_wrapper = $('#wpsstm-player-toggle-scrobble');
            is_scrobbler_active = !link_wrapper.hasClass('active');

            localStorage.setItem("wpsstm-scrobble", is_scrobbler_active);
            
            link_wrapper.toggleClass('active');

        });

        //LAST.FM : user is not logged
        $('.wpsstm-requires-lastfm-auth').click(function(e) {
            if ( !wpsstm_get_current_user_id() ){
                e.preventDefault();
                $('#wpsstm-bottom-notice-wp-auth').show();
                return;
            }
            if ( !wpsstm_is_lastfm_api_logged() ){
                e.preventDefault();
                $('#wpsstm-bottom-notice-lastfm-auth').show();
            }
        });

    });
    
    $( document ).on( "wpsstmTrackAction", function( event,track_obj,track_action,args_obj ) {
        switch(track_action) {
            
            case 'love_unlove':

                var track = {
                    artist: track_obj.artist,
                    title:  track_obj.title,
                    album:  track_obj.album
                }
                
                
                var lastfm_icon = $('#wpsstm-player-toggle-scrobble');
                
                var ajax_data = {
                    action:     'wpsstm_lastfm_love_unlove_track',
                    do_love:    args_obj.do_love,
                    track:      track
                };
                
                console.log("lastFM - love/unlove track");
                
                return $.ajax({

                    type: "post",
                    url: wpsstmL10n.ajaxurl,
                    data:ajax_data,
                    dataType: 'json',
                    beforeSend: function() {
                        lastfm_icon.addClass('loading');
                    },
                    success: function(data){
                        if (data.success === false) {
                            console.log(data);
                        }else{
                        }
                    },
                    complete: function() {
                        lastfm_icon.removeClass('loading');
                    }
                })
                
            break;
        };
    });
    
    $( document ).on( "wpsstmPlayerMediaEvent", function( event,mediaEvent,media,node,player,track_obj ) {

        switch(mediaEvent) {
            case 'loadeddata':
                if (is_scrobbler_active){
                    wpsstm_updateNowPlaying(media,node,player,track_obj);
                }

            break;
            case 'ended':
                
                if (is_scrobbler_active){
                    wpsstm_scrobble(media,node,player,track_obj);
                }

            break;
        }
    });
    
    function wpsstm_is_lastfm_api_logged(){
        return parseInt(wpsstmLastFM.is_api_logged);
    }
    
    /*
    last.fm API - track.updateNowPlaying
    */
    
    function wpsstm_updateNowPlaying(media,node,player,track_obj){
        var track = {
            artist: track_obj.artist,
            title:  track_obj.title,
            album:  track_obj.album
        }

        var ajax_data = {
            action:           'wpsstm_lastfm_update_now_playing_track',
            track:            track
        };
        
        console.log("lastfm - ajax track.updateNowPlaying");

        return $.ajax({

            type: "post",
            url: wpsstmL10n.ajaxurl,
            data:ajax_data,
            dataType: 'json',
            beforeSend: function() {
                $(toggle_scrobble_el).addClass('loading');
            },
            success: function(data){
                if (data.success === false) {
                    console.log(data);
                }
            },
            complete: function() {
                $(toggle_scrobble_el).removeClass('loading');
            }
        })
    }
    
    /*
    last.fm API - track.scrobble
    */
    
    function wpsstm_scrobble(media,node,player,track_obj){

        if ( media.duration <= 30) return;
        
        var track = {
            artist:     track_obj.artist,
            title:      track_obj.title,
            album:      track_obj.album,
            duration:   track_obj.duration
        }

        var ajax_data = {
            action:             'wpsstm_lastfm_scrobble_track',
            track:              track,
            playback_start:     track_obj.playback_start
        };

        console.log("lastfm - ajax track.scrobble");

        return $.ajax({

            type: "post",
            url: wpsstmL10n.ajaxurl,
            data:ajax_data,
            dataType: 'json',
            beforeSend: function() {
                $(toggle_scrobble_el).addClass('loading');
            },
            success: function(data){
                if (data.success === false) {
                    console.log(data);
                }
            },
            complete: function() {
                $(toggle_scrobble_el).removeClass('loading');
            }
        })
    }


    
})(jQuery);
