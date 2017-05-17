var is_scrobbler_active = wpsstmLastFM.is_scrobbler_active;
var toggle_scrobble_el = null;

(function($){

    $(document).ready(function(){
        
        toggle_scrobble_el = $('#wpsstm-player-toggle-scrobble');

        //LAST.FM : toggle scrobbling
        $('#wpsstm-player-toggle-scrobble a').click(function(e) {
            e.preventDefault();
            if ( !wpsstm_is_lastfm_api_logged() ) return;
            
            var link = $(this);
            var link_wrapper = $('#wpsstm-player-toggle-scrobble');
            var do_scrobble = !link_wrapper.hasClass('active');

            var ajax_data = {
                action:             'wpsstm_toggle_scrobbling',
                do_scrobble:        do_scrobble,
            };
            
            console.log("toggle_scrobbling:" + do_scrobble);

            return $.ajax({

                type: "post",
                url: wpsstmL10n.ajaxurl,
                data:ajax_data,
                dataType: 'json',
                beforeSend: function() {
                    link_wrapper.addClass('loading');
                },
                success: function(data){
                    if (data.success === false) {
                        console.log(data);
                    }else{
                        if (do_scrobble){
                            is_scrobbler_active = true;
                            link_wrapper.addClass('active');
                        }else{
                            is_scrobbler_active = false;
                            link_wrapper.removeClass('active');
                        }
                        
                    }
                },
                complete: function() {
                    link_wrapper.removeClass('loading');
                }
            })
            
            
        });

        //LAST.FM : user is not logged
        $('.wpsstm-track-action-lastfm').click(function(e) {
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
        
        //LAST.FM : love / unlove track
        $('.wpsstm-love-track,.wpsstm-unlove-track').click(function(e) {
            if ( !wpsstm_is_lastfm_api_logged() ) return;
            //if (lastm_auth_notice.length > 0) return;
            e.preventDefault();
            
            var link = $(this);
            var link_wrapper = link.closest('.wpsstm-love-unlove-links');
            var track_obj = wpsstm_page_tracks[wpsstm_current_track_idx];

            var track = {
                artist: track_obj.artist,
                title:  track_obj.title,
                album:  track_obj.album
            }
            
            var love = link.hasClass('wpsstm-love-track'); //is love or unlove ?

            var ajax_data = {
                action:           'wpsstm_love_unlove_track',
                love:             love,
                track:            track
            };
            
            console.log("love/unlove track:");
            console.log(ajax_data);

            return $.ajax({

                type: "post",
                url: wpsstmL10n.ajaxurl,
                data:ajax_data,
                dataType: 'json',
                beforeSend: function() {
                    link_wrapper.addClass('loading');
                },
                success: function(data){
                    if (data.success === false) {
                        console.log(data);
                    }else{
                        if (love){
                            link_wrapper.addClass('wpsstm-is-loved');
                        }else{
                            link_wrapper.removeClass('wpsstm-is-loved');
                        }
                        
                    }
                },
                complete: function() {
                    link_wrapper.removeClass('loading');
                }
            })
            
            
        });
        
        //LAST.FM : update track playing

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

        console.log("lastfm - ajax track.updateNowPlaying:");
        console.log(ajax_data);

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

        console.log("lastfm - ajax track.scrobble:");
        console.log(ajax_data);

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