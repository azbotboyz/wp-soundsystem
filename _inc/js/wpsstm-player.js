var bottom_block;
var bottom_notice_refresh;
var wpsstm_player;
var wpsstm_current_media;
var wpsstm_countdown_s = wpsstmPlayer.autoredirect; //seconds for the redirection notice
var wpsstm_countdown_timer; //redirection timer
var wpsstm_track_source_requests_limit = 5; //number of following tracks we want to populate the sources for when clicking a track

var wpsstm_had_tracks_played = false;
var wpsstm_current_track_idx = -1;

(function($){

    $(document).ready(function(){

        bottom_block = $('#wpsstm-bottom');
        bt_prev_track = $('#wpsstm-player-nav-previous-track');
        bt_next_track = $('#wpsstm-player-nav-next-track');
        bottom_notice_refresh = $('#wpsstm-bottom-notice-redirection');
        
        /* tracklist */

        //autoplay first track
        if ( wpsstmPlayer.autoplay ){
            if(typeof wpsstm_page_tracks[0] === 'undefined') return; //track does not exists
            console.log("autoplay first track");
            wpsstm_init_track(0);
        }

        /*
        bottom player
        */
        
        bt_prev_track.click(function(e) {
            e.preventDefault();
            wpsstm_play_previous_track();
        });
        
        bt_next_track.click(function(e) {
            e.preventDefault();
            wpsstm_play_next_track();
        });

        //source item
        $( ".wpsstm-player-sources-list li .wpsstm-source-title" ).live( "click", function(e) {
            e.preventDefault();

            var track_el = $(this).closest('[itemprop="track"]');
            var track_sources_count = track_el.attr('data-wpsstm-sources-count');
            if ( track_sources_count < 2 ) return;
            
            var sources_list = $(this).closest('ul');
            var sources_list_wrapper = sources_list.closest('td.trackitem_sources');
            var li_el = $(this).closest('li');
            sources_list.closest('ul').append(li_el); //move it at the bottom

            if ( !li_el.hasClass('wpsstm-active-source') ){ //source switch
                
                var lis = li_el.closest('ul').find('li');
                lis.removeClass('wpsstm-active-source');
                li_el.addClass('wpsstm-active-source');
                
                var idx = li_el.attr('data-wpsstm-source-idx');
                wpsstm_switch_track_source(idx);
            }
            
            sources_list_wrapper.toggleClass('expanded');
            
            
        });
        
        /*
        timer notice
        */

        bottom_notice_refresh.click(function() {
            
            if ( wpsstm_countdown_s == 0 ) return;
            
            if ( $(this).hasClass('active') ){
                clearInterval(wpsstm_countdown_timer);
            }else{
                wpsstm_redirection_countdown();
            }
            
            $(this).toggleClass('active');
            $(this).find('i.fa').toggleClass('fa-spin');
        });
        
        /*
        page buttons
        */
        
        $( ".wpsstm-play-track" ).live( "click", function(e) {
            e.preventDefault();
            var track_el = $(this).closest('tr');
            var track_idx = $(track_el).attr('data-wpsstm-track-idx');
            
            if ( $(track_el).hasClass('active') ){
                if ( $(track_el).hasClass('playing') ){
                    wpsstm_current_media.pause();
                }else{
                    wpsstm_current_media.play();
                }
            }else{
                wpsstm_init_track(track_idx);
            }

        });

    });

    //Confirmation popup is a media is playing and that we leave the page
    
    $(window).bind('beforeunload', function(){
        if (!wpsstm_current_media.paused){
            return wpsstmPlayer.leave_page_text;
        }
    });
    
    /*
    Initialize a track : either play it if it has sources; or get the sources then call this function again (with after_ajax = true)
    */
    
    function wpsstm_init_track(track_idx,after_ajax = false) {
        
        track_idx = Number(track_idx); //cast to number
        if(typeof wpsstm_page_tracks[track_idx] === 'undefined') return; //track does not exists
        
        var track_obj = wpsstm_page_tracks[track_idx];
        var track_el = $(track_obj.row);
        track_el.addClass('active');

        //wpsstm_init_track() is called a second time after tracks sources have been populated.  Do not run this code again.
        if (!after_ajax){
            if ( wpsstm_current_track_idx && ( wpsstm_current_track_idx == track_idx ) ) return;
            wpsstm_init_sources_request(track_idx);
        }

        console.log("wpsstm_init_track #" + track_idx);
        
        //skip the current track if any
        wpsstm_end_current_track();

        //new track
        wpsstm_current_track_idx = track_idx;

        //play current track if it has sources

        if (track_obj.sources){
            wpsstm_switch_player(track_idx);
        }else if (track_obj.did_lookup){ //no sources and had lookup
            wpsstm_play_next_track();
        }

    }

    function wpsstm_end_current_track(){

        if (wpsstm_current_track_idx == -1) return;
        
        console.log("wpsstm_end_current_track() #" + wpsstm_current_track_idx);

        var old_track_obj = wpsstm_page_tracks[wpsstm_current_track_idx];
        var old_track_el = $(old_track_obj.row);
        old_track_el.removeClass('active');
        old_track_el.addClass('has-played');
        
        //mediaElement
        if (wpsstm_current_media){
            console.log("there is an active media, abord it");
            
            wpsstm_current_media.pause();
            wpsstm_update_track_button(old_track_obj,'ended');

        }

    }

    function wpsstm_switch_player(track_idx){
        console.log("wpsstm_switch_player()  #" + track_idx);
        
        var track_obj = wpsstm_page_tracks[track_idx];
        var track_el = $(track_obj.row);
        
        //track infos
        var trackinfo = $(track_el).clone();
        trackinfo.show();
        trackinfo.find('td.trackitem_play_bt').remove();
        $('#wpsstm-player-trackinfo').html(trackinfo);

        //player sources

        var media_wrapper = $('<audio />');
        media_wrapper.attr({
            id:     'wpsstm-player-audio'
        });
        
        media_wrapper.prop({
            //autoplay:     true,
            //muted:        true
        });

        $(track_obj.sources).each(function(i, source_attr) {
            //media
            var source_el = $('<source />');
            source_el.attr({
                src:    source_attr.src,
                type:   source_attr.type
            });
            
            media_wrapper.append(source_el);

        });

        $('#wpsstm-player').html(media_wrapper);
        
        //display bottom block if not done yet
        bottom_block.show();
        
        new MediaElementPlayer('wpsstm-player-audio', {
            classPrefix: 'mejs-',
            // All the config related to HLS
            hls: {
                debug: true,
                autoStartLoad: false
            },
            // Do not forget to put a final slash (/)
            pluginPath: 'https://cdnjs.com/libraries/mediaelement/',
            //audioWidth: '100%',
            stretching: 'responsive',
            features: ['playpause','loop','progress','current','duration','volume'],
            loop: false,
            success: function(media, node, player) {
                    console.log("MediaElementPlayer ready");
                
                    wpsstm_player = player;
                    wpsstm_current_media = media;

                    $(wpsstm_current_media).on('error', function(error) {
                        var current_source = $(wpsstm_current_media).find('audio').attr('src');
                        console.log('player event - source error: '+current_source);
                        wpsstm_update_track_button(track_obj,'loadeddata');
                        wpsstm_skip_bad_source(wpsstm_current_media);

                    });

                    $(wpsstm_current_media).on('loadeddata', function() {
                        console.log('player event - loadeddata');
                        wpsstm_update_track_button(track_obj,'loadeddata');
                        $( document ).trigger( "wpsstmPlayerMediaEvent", ['loadeddata',media, node, player,track_obj] ); //register custom event - used by lastFM for the track.updateNowPlaying call
                        
                        wpsstm_player.play();
                        
                    });

                    $(wpsstm_current_media).on('play', function() {
                        if (media.duration <= 0) return; //quick fix because it was fired twice.
                        track_obj.duration = Math.floor(media.duration);
                        track_obj.playback_start = Math.round( $.now() /1000); //seconds - used by lastFM
                        console.log('player event - play');
                        wpsstm_update_track_button(track_obj,'play');
                        wpsstm_had_tracks_played = true;
                    });

                    $(wpsstm_current_media).on('pause', function() {
                        console.log('player - pause');
                        wpsstm_update_track_button(track_obj,'pause');
                    });

                    $(wpsstm_current_media).on('ended', function() {
                        console.log('MediaElement.js event - ended');
                        wpsstm_update_track_button(track_obj,'ended');
                        wpsstm_current_media = null;

                        $( document ).trigger( "wpsstmPlayerMediaEvent", ['ended',media, node, player,track_obj] ); //register custom event - used by lastFM for the track.scrobble call
                        
                        //Play next song if any
                        wpsstm_play_next_track();
                    });

                },error(media) {
                    // Your action when media had an error loading
                    //TO FIX is this required ?
                    console.log("player error");
                }
        });
        
    }
    
    function wpsstm_switch_track_source(idx){
        var new_source = $(wpsstm_current_media).find('audio source').eq(idx);
        
        console.log("wpsstm_switch_track_source() #" + idx);
        console.log(new_source.get(0));
        
        
        var player_url = $(wpsstm_current_media).find('audio').attr('src');
        var new_source_url = new_source.attr('src');

        if (player_url == new_source_url) return false;

        //player
        wpsstm_current_media.pause();
        wpsstm_current_media.setSrc(new_source);
        wpsstm_current_media.load();
        wpsstm_current_media.play();

        //trackinfo
        var trackinfo_sources = $('#wpsstm-player-sources-wrapper li');
        var trackinfo_new_source = trackinfo_sources.eq(idx);
        trackinfo_sources.removeClass('wpsstm-active-source');

        trackinfo_new_source.addClass('wpsstm-active-source');
    }

    function wpsstm_skip_bad_source(media){
        console.log("try to get next source or next media");
        
       //https://github.com/mediaelement/mediaelement/issues/2179#issuecomment-297090067
        
        var current_source_url = $(media).find('audio').attr('src');
        var source_els = $(media).find('source');
        var source_els_clone = $(media).find('source').clone();
        var new_source_idx = -1;

        source_els_clone.each(function(i, val) {

            var source = $(this);
            var source_url = source.attr('src');
            
            if (!source_url) return true; //continue
            if (source.hasClass('wpsstm-bad-source')) return true; //continue;

            if ( source_url == current_source_url ) {
                
                $(source_els_clone).eq(i).remove(); //remove from loop
                $(source_els).eq(i).addClass('wpsstm-bad-source'); //add class to source
                $('#wpsstm-player-sources-wrapper li').eq(i).addClass('wpsstm-bad-source');//add class to trackinfo source
                
                console.log("skip; is current source: "+source_url);
                return true; //continue
            }
            
            new_source_idx = i;
            return false;  //break

        });
        
        if (new_source_idx > -1){
            wpsstm_switch_track_source(new_source_idx);
        }else{
            
            //No valid source found
            var track_obj = wpsstm_page_tracks[wpsstm_current_track_idx];
            var track_el = $(track_obj.row);
            track_el.addClass('error');

            //No more sources - Play next song if any
            wpsstm_play_next_track();
        }
        
    }
    
    function wpsstm_play_previous_track(){
        var previous_idx = wpsstm_current_track_idx - 1;
        wpsstm_init_track(previous_idx);
    }

    function wpsstm_play_next_track(){
        var next_idx = wpsstm_current_track_idx + 1;
        
        if(typeof wpsstm_page_tracks[next_idx] === 'undefined'){
            console.log("tracklist end");
            wpsstm_redirection_countdown();
        }else{
            wpsstm_init_track(next_idx);
        }

    }

    function wpsstm_redirection_countdown(){
        
        // No tracks have been played on the page.  Avoid infinite redirection loop.
        if ( !wpsstm_had_tracks_played ) return;

        if ( bottom_notice_refresh.length == 0) return;

        var redirect_url = null;
        var redirect_link = bottom_notice_refresh.find('a#wpsstm-bottom-notice-link');

        if (redirect_link.length > 0){
            redirect_url = redirect_link.attr('href');
        }

        bottom_notice_refresh.show();

        var container = bottom_notice_refresh.find('strong');
        var message = "";
        var message_end = "";

        // Get reference to container, and set initial content
        container.html(wpsstm_countdown_s + message);

        if ( wpsstm_countdown_s <= 0) return;

        // Get reference to the interval doing the countdown
        wpsstm_countdown_timer = setInterval(function () {
            container.html(wpsstm_countdown_s + message);
            // If seconds remain
            if (--wpsstm_countdown_s) {
                // Update our container's message
                container.html(wpsstm_countdown_s + message);
            // Otherwise
            } else {
                wpsstm_countdown_s = 0;
                // Clear the countdown interval
                clearInterval(wpsstm_countdown_timer);
                // Update our container's message
                container.html(message_end);

                // And fire the callback passing our container as `this`
                console.log("redirect to:" + redirect_url);
                window.location = redirect_url;
            }
        }, 1000); // Run interval every 1000ms (1 second)
    }

    
})(jQuery);
