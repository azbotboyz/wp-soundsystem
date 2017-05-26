var bottom_block_el;
var bottom_player_el;
var wpsstm_player;
var wpsstm_current_media;
var wpsstm_countdown_s = wpsstmPlayer.autoredirect; //seconds for the redirection notice
var wpsstm_track_source_requests_limit = 5; //number of following tracks we want to populate the sources for when clicking a track
var wpsstm_player_shuffle_el; //shuffle button
//those are the globals for autoplay and tracks navigation
var wpsstm_page_player;


(function($){

    $(document).ready(function(){

        bottom_block_el =           $('#wpsstm-bottom');
        bottom_player_el =          $(bottom_block_el).find('#wpsstm-bottom-player');
        wpsstm_player_shuffle_el =  $('#wpsstm-player-shuffle');
        bt_prev_track =             $('#wpsstm-player-extra-previous-track');
        bt_next_track =             $('#wpsstm-player-extra-next-track');

        //init tracklists
        var all_tracklists = $( ".wpsstm-tracklist" );
        wpsstm_page_player.populate_tracklists(all_tracklists);

        /*
        page buttons
        */
        
        $( ".wpsstm-play-track" ).live( "click", function(e) {
            e.preventDefault();

            var tracklist_el = $(this).closest('.wpsstm-tracklist');
            var tracklist_idx = $(tracklist_el).attr('data-wpsstm-tracklist-idx');
            
            var track_el = $(this).closest('tr');
            var track_idx = $(track_el).attr('data-wpsstm-track-idx');

            if ( $(track_el).hasClass('active') ){
                if ( $(track_el).hasClass('playing') ){
                    wpsstm_current_media.pause();
                }else{
                    wpsstm_current_media.play();
                }
            }else{
                var tracklist_obj = wpsstm_page_player.get_tracklist_obj(tracklist_idx);
                tracklist_obj.init_tracklist(track_idx);
            }

        });
        
        /*
        Player : previous / next
        */

        bt_prev_track.click(function(e) {
            e.preventDefault();
            var tracklist_obj = wpsstm_page_player.get_tracklist_obj();
            tracklist_obj.play_previous_track();
        });
        
        bt_next_track.click(function(e) {
            e.preventDefault();
            var tracklist_obj = wpsstm_page_player.get_tracklist_obj();
            tracklist_obj.play_next_track();
        });
        
        //love/unlove track (either for page tracks or player track)
        $('[itemprop="track"] .wpsstm-love-unlove-track-links a').live( "click", function(e) {
            e.preventDefault();
            
            var link = $(this);
            var link_wrapper = link.closest('.wpsstm-love-unlove-track-links');
            var do_love = !link_wrapper.hasClass('wpsstm-is-loved');
            
            var tracklist_el = link.closest('[data-wpsstm-tracklist-idx]');
            var tracklist_idx = tracklist_el.attr('data-wpsstm-tracklist-idx');
            
            var track_el = link.closest('[itemprop="track"]');
            var track_idx = track_el.attr('data-wpsstm-track-idx');
            
            var track_obj = wpsstm_page_player.get_tracklist_track_obj(tracklist_idx,track_idx);
            track_obj.love_unlove(do_love);

        });
        
        //source item
        //TO FIX this should be under WpsstmTrackSource
        $( ".wpsstm-player-sources-list li .wpsstm-source-title" ).live( "click", function(e) {

            e.preventDefault();

            var track_el = $(this).closest('[itemprop="track"]');
            var track_idx = Number( track_el.attr('data-wpsstm-track-idx') );
            
            var tracklist_obj = wpsstm_page_player.get_tracklist_obj();
            var track_obj = tracklist_obj.get_track_obj(track_idx);

            var source_el = $(this).closest('li');
            var source_idx = Number( source_el.attr('data-wpsstm-source-idx') );
            var source = tracklist_obj.get_track_obj(track_idx).get_track_source(source_idx);
            source.select_source_list();

        });

        //user is not logged for action
        $('.wpsstm-requires-auth').click(function(e) {
            if ( !wpsstm_get_current_user_id() ){
                e.preventDefault();
                $('#wpsstm-bottom-notice-wp-auth').addClass('active');
            }

        });
        
        /*
        Player : shuffle
        */
        
        if ( wpsstm_page_player.is_player_shuffle() ){
            $(wpsstm_player_shuffle_el).addClass('active');
        }
        
        $('#wpsstm-player-shuffle a').click(function(e) {
            e.preventDefault();
            
            var is_active = !wpsstm_page_player.is_player_shuffle();
            
            if (is_active){
                localStorage.setItem("wpsstm-player-shuffle", true);
                $(wpsstm_player_shuffle_el).addClass('active');
            }else{
                localStorage.removeItem("wpsstm-player-shuffle");
                 $(wpsstm_player_shuffle_el).removeClass('active');
            }
            
            
        });
        

    });

    //Confirmation popup is a media is playing and that we leave the page
    
    $(window).bind('beforeunload', function(){
        if (!wpsstm_current_media.paused){
            return wpsstmPlayer.leave_page_text;
        }
    });

})(jQuery);

class WpsstmTracklist {
    constructor(tracklist_el,tracklist_index) {

        var self = this;
        self.current_track_idx;
        self.tracklist_request;
        self.tracklist_idx =            tracklist_index;
        self.tracks =                   [];
        self.tracks_shuffle_order =     [];
        self.seconds_before_refresh =   null;
        self.did_tracklist_request =    true;
        
        self.populate_tracklist(tracklist_el);
        
        //time for a refresh ?
        if ( self.expire_time && ( self.expire_time <= Math.floor( Date.now() / 1000) ) ){
            self.did_tracklist_request = false;
        }

    }
    
    populate_tracklist(tracklist_el){
        
        console.log("WpsstmTracklist:populate_tracklist()");
        
        var self = this;
        jQuery(tracklist_el).attr('data-wpsstm-tracklist-idx',self.tracklist_idx);

        self.tracklist_id = Number( jQuery(tracklist_el).attr('data-tracklist-id') );
        self.expire_time =  Number( jQuery(tracklist_el).attr('data-wpsstm-next-refresh') );
        
        /*
        Refresh playlist link
        */
        var refresh_link = $( tracklist_el ).find("a.wpsstm-refresh-playlist" );
        $(refresh_link).click(function(e) {
            e.preventDefault();
            self.did_tracklist_request = false; //unset did request status
            self.init_tracklist(); //initialize but do not set track to play
            
        });
        
        var tracks_html = jQuery(tracklist_el).find('[itemprop="track"]');
        
        if ( tracks_html.length > 0 ){
            jQuery.each(tracks_html, function( index, track_html ) {
                var new_track = new WpsstmTrack(track_html,self.tracklist_idx,index);
                self.tracks.push(new_track);
                self.tracks_shuffle_order.push(index);
            });

            self.tracks_shuffle_order = wpsstm_shuffle(self.tracks_shuffle_order);

        }

    }
    
    update_refresh_timer(){
        var self = this;
        self.seconds_before_refresh = self.seconds_before_refresh - 1;
        
        /*
        Live-update countdown -- TO FIX disabled for now because it might take ressources and we don't really need it
        */

        var tracklist_el = self.get_tracklist_el();
        var tracklist_time_el = jQuery(tracklist_el).find('.wpsstm-tracklist-time');
        
        /*
        var countdown_el = jQuery(tracklist_time_el).find('.wpsstm-live-tracklist-expiry-countdown');
        var time_el = jQuery(countdown_el).find('time');
        var time_hours_el = time_el.find('.wpsstm-tracklist-refresh-hours');
        var time_minutes_el = time_el.find('.wpsstm-tracklist-refresh-minutes');
        var time_seconds_el = time_el.find('.wpsstm-tracklist-refresh-seconds');

        //https://stackoverflow.com/a/8211778/782013
        var current_days = Math.floor((self.seconds_before_refresh % 31536000) / 86400);
        var current_hours = Math.floor(((self.seconds_before_refresh % 31536000) % 86400) / 3600);
        var current_minutes = Math.floor((((self.seconds_before_refresh % 31536000) % 86400) % 3600) / 60);
        var current_seconds = (((self.seconds_before_refresh % 31536000) % 86400) % 3600) % 60;
        
        if (current_days < 0) current_days = 0;
        if (current_hours < 0) current_hours = 0;
        if (current_minutes < 0) current_minutes = 0;
        if (current_seconds < 0) current_seconds = 0;
        
        //two digits
        current_hours =     ("0" + current_hours).slice(-2);
        current_minutes =   ("0" + current_minutes).slice(-2);
        current_seconds =   ("0" + current_seconds).slice(-2);
        
        time_hours_el.text(current_hours);
        time_minutes_el.text(current_minutes);
        time_seconds_el.text(current_seconds);
        
        */
        
        if (self.seconds_before_refresh <= 0){
            $(tracklist_time_el).addClass('can-refresh');
            self.seconds_before_refresh = 0;
            clearInterval(self.refresh_timer);
        }
        
    }

    get_tracklist_request(){

        console.log("WpsstmTracklist:get_tracklist_request()");
        
        var self = this;
        var tracklist_el = self.get_tracklist_el();
        var refresh_notice = null;
        var deferredObject = $.Deferred();

        var ajax_data = {
            'action':           'wpsstm_load_tracklist',
            'post_id':          this.tracklist_id
        };
        
        var refresh_notice = self.get_refresh_notice();
        var refresh_notice_table = $(refresh_notice).clone();
        refresh_notice_table.find('em').remove();
        refresh_notice_table = jQuery( refresh_notice_table.html() );
        
        $(bottom_block_el).prepend(refresh_notice);
        //replace 'not found' text by refresh notice
        $(tracklist_el).find('tr.no-items td').append( refresh_notice_table );
        $(tracklist_el).addClass('loading');

        var promise = $.ajax({

            type: "post",
            url: wpsstmL10n.ajaxurl,
            data:ajax_data,
            dataType: 'json'
        });

        promise.done(function(data) {
            
            if (data.success === false) {
                deferredObject.reject();
            }else{
                var new_tracklist_el = jQuery(data.new_html);
                $(tracklist_el).replaceWith(new_tracklist_el);
                self.populate_tracklist(new_tracklist_el);
                deferredObject.resolve();
            }

        });
        
        promise.always(function() {
            self.did_tracklist_request = true; //so we can avoid running this function several times
            $(refresh_notice_table).remove();
            refresh_notice.remove();
            $(tracklist_el).removeClass('loading');
        });
        
        return deferredObject.promise();

    }
    
    get_track_obj(track_idx){
        var self = this;
        
        if(typeof track_idx === 'undefined'){
            track_idx = self.current_track_idx;
        }

        track_idx = Number(track_idx);
        var track_obj = self.tracks[track_idx];
        if(typeof track_obj === 'undefined') return;
        return track_obj;
    }
    
    get_tracklist_el(){
        var tracklist_el = jQuery('.wpsstm-tracklist[data-wpsstm-tracklist-idx="'+this.tracklist_idx+'"]');
        return tracklist_el;
    }

    get_maybe_shuffle_track_idx(idx){
        var self = this;
        if ( !wpsstm_page_player.is_player_shuffle() ) return idx;
        var new_idx = self.tracks_shuffle_order[idx];
        
        console.log("WpsstmTracklist:get_maybe_shuffle_track_idx() : " + idx + "-->" + new_idx);
        return new_idx;
    }
    
    get_maybe_unshuffle_track_idx(idx){
        var self = this;
        if ( !wpsstm_page_player.is_player_shuffle() ) return idx;
        var shuffle_order = self.tracks_shuffle_order;
        var new_idx = shuffle_order.indexOf(idx);
        console.log("WpsstmTracklist:get_maybe_unshuffle_track_idx() : " + idx + "-->" + new_idx);
        return new_idx;
    }

    abord_tracks_sources_request() {
        
        var self = this;
        
        $.each(self.tracks, function( index, track ) {
            if (track.sources_request){
                //TO FIX
                //track.sources_request.abort();
            }
        });

    };

    play_previous_track(){
        var self = this;
        
        var current_track_idx = self.get_maybe_unshuffle_track_idx(self.current_track_idx);
        var queue_track_idx = current_track_idx; //get real track index
        var first_track_idx = 0;
        var new_track;

        //try to get previous track
        for (var i = 0; i < self.tracks.length; i++) {
            
            console.log(i + " VS " + first_track_idx);

            if (queue_track_idx == first_track_idx){
                console.log("WpsstmTracklist:play_previous_track() : is tracklist first track");
                break;
            }
            
            queue_track_idx = Number(queue_track_idx) - 1;
            queue_track_idx = self.get_maybe_shuffle_track_idx(queue_track_idx);
            var check_track = self.get_track_obj(queue_track_idx);

            if (check_track.can_play){
                new_track = check_track;
                break;
            }
        }
        
        if (new_track){
            console.log("WpsstmTracklist:play_previous_track() #" + queue_track_idx + " in playlist#" + self.tracklist_idx);
            new_track.play_or_skip();
        }
    }
    
    play_next_track(){
        var self = this;
        
        var current_track_idx = self.get_maybe_unshuffle_track_idx(self.current_track_idx);
        var queue_track_idx = current_track_idx;
        var last_track_idx = self.tracks.length -1;
        var new_track;

        //try to get previous track
        for (var i = 0; i < self.tracks.length; i++) {

            if (queue_track_idx == last_track_idx){
                console.log("WpsstmTracklist:play_next_track() : is tracklist last track");
                break;
            } 
            
            queue_track_idx = Number(queue_track_idx) + 1;

            queue_track_idx = self.get_maybe_shuffle_track_idx(queue_track_idx);
            var check_track = self.get_track_obj(queue_track_idx);

            console.log(current_track_idx);
            console.log(queue_track_idx);
            console.log(check_track);

            if ( check_track.can_play){
                new_track = check_track;
                break;
            }
        }
        
        if (new_track){
            console.log("WpsstmTracklist:play_previous_track() #" + queue_track_idx + " in playlist#" + self.tracklist_idx);
            new_track.play_or_skip();
        }
        /*
        if ( (next_track === undefined) && wpsstmPlayer.autoplay ){

            //try to start next tracklist if any
            var next_tracklist_idx = self.tracklist_idx + 1;
            var next_tracklist_obj;

            next_tracklist_obj = wpsstm_page_player.get_tracklist_obj(next_tracklist_idx)

            //no next playlist, get first one
            if ( !next_tracklist_obj ){
                next_tracklist_idx = 0;
                next_tracklist_obj = wpsstm_page_player.get_tracklist_obj(next_tracklist_idx);
            }

            next_tracklist_obj.current_track_idx = 0;

            console.log("WpsstmTracklist:play_next_track() - set autoplay playlist #" + wpsstm_page_player.current_tracklist_idx + " track#" + track_idx);

            if ( next_tracklist_obj.seconds_before_refresh === 0 ){ //if it needs a refresh first
                next_tracklist_obj.get_tracklist_request();
            }else{
                next_tracklist_obj.init_tracklist();
            }

        }
        */
    }

    end_current_track(){
        var self = this;
        var current_track = self.get_track_obj();
        if (current_track){
            current_track.end_track();
            self.current_track_idx = null;
        }
    }
    
    /*
    timer notice
    */
    
    init_refresh_timer(){
        var self = this;
        
        //expire countdown
        if (!self.expire_time || self.expire_time <= 0) return;
        
        self.seconds_before_refresh = this.expire_time - Math.floor( Date.now() / 1000);
        
        if (!self.seconds_before_refresh || self.seconds_before_refresh <= 0) return;
        
        console.log('init_refresh_timer');
        
        console.log("set timer for " + self.expire_time);
        if (self.refresh_timer){ //stop current timer if any
            clearInterval(self.refresh_timer);
            self.refresh_timer = null;
        }
        
        console.log("this tracklist could refresh in "+ self.seconds_before_refresh +" seconds");

        self.refresh_timer = setInterval ( function(){
                return self.update_refresh_timer();
        }, 1000 );
    }

    get_refresh_notice(){
        
        console.log("get_refresh_notice");
        
        var self = this;
        var notice_el = jQuery('<p />');
        var tracklist = this.get_tracklist_el();
        var tracklist_title = $(tracklist).find('[itemprop="name"]').first().text();
        
        notice_el.attr({
            class:  'wpsstm-bottom-notice active'
        });
        
        var notice_icon_el = jQuery('<i class="fa fa-refresh fa-fw fa-spin"></i>');
        var notice_message_el = jQuery('<span />');
        var playlist_title = jQuery('<em />');
        playlist_title.text("  " +tracklist_title);
        notice_message_el.html(wpsstmPlayer.refreshing_text);
        notice_message_el.append(playlist_title);
        
        notice_el.append(notice_icon_el).append(notice_message_el);

        return notice_el;
    }
    
    init_tracklist(track_idx){
        
        var self = this;
        var tracklist_el = self.get_tracklist_el();

        //set as active playlist
        console.log("WpsstmTracklist:init_tracklist() #" +  self.tracklist_idx);
        wpsstm_page_player.current_tracklist_idx = self.tracklist_idx;

        //set active track if any
        if (track_idx !== undefined){
            track_idx = track_idx;
        }else{
            track_idx = self.get_maybe_shuffle_track_idx(0);
        }
        
        console.log("WpsstmTracklist:init_tracklist() track#" +  track_idx);
        
        self.tracklist_request = $.Deferred();

        if (self.did_tracklist_request){
            self.tracklist_request.resolve();
        }else{
            self.tracklist_request = self.get_tracklist_request();
        }

        self.tracklist_request.fail(function(jqXHR, textStatus, errorThrown) {
            $(tracklist_el).addClass('error');
            console.log("WpsstmTracklist:get_tracklist_request() failed");
            console.log({jqXHR:jqXHR,textStatus:textStatus,errorThrown:errorThrown});
        })
        .done(function() {
            var play_track = self.get_track_obj(track_idx);
            play_track.play_or_skip();
        })
        .then(function(data, textStatus, jqXHR) {})
        .always(function(data, textStatus, jqXHR) {
            //item.statusText = null;
            //self.sources_request.$apply();
            
        })

    }
}

class WpsstmTrack {
    constructor(track_html,tracklist_idx,track_idx) {

        var self =                  this;
        self.tracklist_idx =        tracklist_idx; //cast to number;
        self.track_idx =            track_idx;
        self.artist =               $(track_html).find('[itemprop="byArtist"]').text();
        self.title =                $(track_html).find('[itemprop="name"]').text();
        self.album =                $(track_html).find('[itemprop="inAlbum"]').text();
        self.post_id =              $(track_html).attr('data-wpsstm-track-id');
        self.sources_request =      $.Deferred();
        self.did_sources_request =  false;
        self.can_play =             true;
        self.sources =              [];
       
        //console.log("new WpsstmTrack #" + this.track_idx + " in tracklist #" + this.tracklist_idx);
        
        jQuery(track_html).attr('data-wpsstm-track-idx',this.track_idx);
        
        //populate existing sources
        self.populate_html_sources();

    }
    
    love_unlove(do_love){

        var self = this;
        var track_instances = $('[data-wpsstm-track-id="'+self.post_id+'"]');
        
        var track_el = self.get_track_el();
        var track_id = self.post_id;
        
        var link_wrappers = track_instances.find('.wpsstm-love-unlove-track-links');

        var track = {
            artist:     self.artist,
            title:      self.title,
            album:      self.album,
            post_id:    self.post_id
        }

        var ajax_data = {
            action:         'wpsstm_love_unlove_track',
            do_love:        do_love,
            track:          track
        };

        return $.ajax({

            type: "post",
            url: wpsstmL10n.ajaxurl,
            data:ajax_data,
            dataType: 'json',
            beforeSend: function() {
                link_wrappers.addClass('loading');
            },
            success: function(data){
                if (data.success === false) {
                    console.log(data);
                }else{
                    
                    if (do_love){
                        $.each(track_instances, function( index, track_instance ) {
                            link_wrappers.addClass('wpsstm-is-loved');
                        });
                    }else{
                        $.each(track_instances, function( index, track_instance ) {
                            link_wrappers.removeClass('wpsstm-is-loved');
                        });
                    }

                }
            },
            complete: function() {
                link_wrappers.removeClass('loading');
                $( document ).trigger( "wpsstmTrackLove", [self,do_love] ); //register custom event - used by lastFM for the track.updateNowPlaying call
            }
        })
    }

    get_track_el(){
        var track_el = jQuery('.wpsstm-tracklist[data-wpsstm-tracklist-idx="'+this.tracklist_idx+'"] [itemprop="track"][data-wpsstm-track-idx="'+this.track_idx+'"]');
        return track_el;
    }
    
    /*
    Update the track button after a media event.
    */

    update_button(event){

        var track_el = this.get_track_el();

        switch(event) {
            case 'loadeddata':
            break;
            case 'error':
                track_el.addClass('error');
            break;
            case 'play':
                track_el.addClass('playing');
                track_el.addClass('has-played');
                track_el.removeClass('error buffering ended');
            break;
            case 'pause':
                track_el.removeClass('playing');
            break;
            case 'ended':
                track_el.removeClass('playing');
                track_el.removeClass('active');
                track_el.removeClass('buffering');
            break;
        }

    }
    
    /*
    Initialize a track : either play it if it has sources; or get the sources then call this function again (with after_ajax = true)
    */

    play_or_skip(after_ajax = false){

        var self = this;
        var tracklist_obj = wpsstm_page_player.get_tracklist_obj(self.tracklist_idx);
        var track_el = self.get_track_el();
        
        console.log(tracklist_obj);

        tracklist_obj.end_current_track();
        tracklist_obj.abord_tracks_sources_request(); //abord current requests
        tracklist_obj.current_track_idx = self.track_idx;
        
        //cannot play this track
        if (!self.can_play) tracklist_obj.play_next_track();
        
        self.sources_request = $.Deferred();
        
        if ( self.sources.length > 0 ){
            self.sources_request.resolve();
        }else if (!self.did_sources_request){
            self.sources_request = self.get_track_sources_request();
        }
        
        self.sources_request.fail(function(jqXHR, textStatus, errorThrown) {

            jQuery(track_el).addClass('error');
            self.can_play = false;

            console.log("sources request failed for track #" + self.track_idx);
            console.log({jqXHR:jqXHR,textStatus:textStatus,errorThrown:errorThrown});

            var tracklist_obj = wpsstm_page_player.get_tracklist_obj(this.tracklist_idx);
            tracklist_obj.play_next_track();
            
        })
        .done(function() {
            self.send_to_player();
        })
        .then(function(data, textStatus, jqXHR) {})
        .always(function(data, textStatus, jqXHR) {
            //item.statusText = null;
            //self.sources_request.$apply();
            
            self.did_sources_request = true;
            jQuery(track_el).removeClass('buffering');
            
            //preload next tracks
            self.preload_next_tracks_sources();
        })

    }
    
    /*
    Init a sources request for this track and the X following ones (if not populated yet)
    */
    
    preload_next_tracks_sources() {
        
        var self = this;
        var tracklist = wpsstm_page_player.tracklists[self.tracklist_idx];

        console.log("WpsstmTrack::preload_next_tracks_sources()");

        var tracks_to_preload = [];
        var max_items = wpsstm_track_source_requests_limit;
        var rtrack_count = 0;
        var rtrack_in = self.track_idx + 1;
        var rtrack_out = self.track_idx + max_items + 1;

        var tracks_slice = $(tracklist.tracks).slice( rtrack_in, rtrack_out );

        jQuery.each(tracks_slice, function( index, rtrack_obj ) {
            rtrack_count++;
            if ( rtrack_obj.did_sources_request ) return true; //continue
            if (rtrack_count > max_items){
                return false;//break
            }else{
                tracks_to_preload.push(rtrack_obj);
            }
        });

        jQuery(tracks_to_preload).each(function(index, track_to_preload) {
            if ( track_to_preload.sources.length == 0 ){
                track_to_preload.sources_request = self.get_track_sources_request();
            }
        });
    }

    send_to_player(){
        var self = this;
        var tracklist = wpsstm_page_player.tracklists[self.tracklist_idx];
        console.log("send_to_player()  tracklist#" + tracklist.tracklist_idx + ", track#" + self.track_idx);

        var track_el    = self.get_track_el();
        
        wpsstm_page_player.track_playing = self;
        jQuery(track_el).addClass('active');

        //track infos
        var trackinfo = $(track_el).clone();
        trackinfo.attr('data-wpsstm-tracklist-idx',self.tracklist_idx); //set tracklist ID for the player
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

        $( self.sources ).each(function(i, source_attr) {
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
        bottom_player_el.show();

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
                        self.update_button('loadeddata');
                        self.skip_bad_source(wpsstm_current_media);

                    });

                    $(wpsstm_current_media).on('loadeddata', function() {
                        console.log('player event - loadeddata');
                        self.update_button('loadeddata');
                        $( document ).trigger( "wpsstmPlayerMediaEvent", ['loadeddata',media, node, player,self] ); //register custom event - used by lastFM for the track.updateNowPlaying call

                        wpsstm_player.play();

                    });

                    $(wpsstm_current_media).on('play', function() {
                        if (media.duration <= 0) return; //quick fix because it was fired twice.
                        self.duration = Math.floor(media.duration);
                        self.playback_start = Math.round( $.now() /1000); //seconds - used by lastFM
                        console.log('player event - play');
                        self.update_button('play');
                    });

                    $(wpsstm_current_media).on('pause', function() {
                        console.log('player - pause');
                        self.update_button('pause');
                    });

                    $(wpsstm_current_media).on('ended', function() {
                        console.log('MediaElement.js event - ended');
                        self.update_button('ended');
                        wpsstm_current_media = null;

                        $( document ).trigger( "wpsstmPlayerMediaEvent", ['ended',media, node, player,self] ); //register custom event - used by lastFM for the track.scrobble call

                        //Play next song if any
                        wpsstm_page_player.tracklists[self.tracklist_idx].play_next_track();
                    });

            },error(media) {
                // Your action when media had an error loading
                //TO FIX is this required ?
                console.log("player error");
            }
        });

    }
    
    get_track_sources_request() {

        var self = this;
        var track_el    = self.get_track_el();
        if (!track_el) return;
        var deferredObject = $.Deferred();

        var track = {
            artist: self.artist,
            title:  self.title,
            album:  self.album
        }
        
        //console.log("WpsstmTrack:get_track_sources_request(): #" + this.track_idx);
        
        var ajax_data = {
            'action':           'wpsstm_player_get_provider_sources',
            'track':            track
        };
        
        var promise = $.ajax({

            type: "post",
            url: wpsstmL10n.ajaxurl,
            data:ajax_data,
            dataType: 'json',
        });
        
        jQuery(track_el).addClass('buffering');
        
        promise.done(function(data) {
            
            if ( (data.success === true) && ( data.new_html ) ){
                jQuery(track_el).find('.trackitem_sources').html(data.new_html); //append new sources
                self.populate_html_sources();
                deferredObject.resolve();
            }else{
                deferredObject.reject();
            }

        });
        
        return deferredObject.promise();

    }
    
    populate_html_sources(){
        var self =      this;
        var track_el =  self.get_track_el();

        var new_sources_items = jQuery(track_el).find('.trackitem_sources li');

        //console.log("found "+new_sources_items.length +" sources for track#" + this.track_idx);
        
        var sources = [];
        jQuery.each(new_sources_items, function( index, li_item ) {
            var new_source = new WpsstmTrackSource(li_item,self);
            self.sources.push(new_source);            
        });
        
        if (!self.sources.length) {
            self.can_play = false;
        }
        
        jQuery(track_el).attr('data-wpsstm-sources-count',self.sources.length);
        
    }
    
    get_track_source(source_idx){
        var self = this;

        source_idx = Number(source_idx);
        var source_obj = self.sources[source_idx];
        if(typeof source_obj === 'undefined') return;
        return source_obj;
    }
    
    switch_track_source(idx){
        var self = this;

        var new_player_source = $(wpsstm_current_media).find('audio source').eq(idx);
        var new_player_source_url = new_player_source.attr('src');
        var current_player_source_url = $(wpsstm_current_media).find('audio').attr('src');

        if (current_player_source_url == new_player_source_url) return false;
        
        var new_source_obj = self.sources[idx];
        console.log("WpsstmTrack:switch_track_source():" + new_player_source_url);

        //player
        wpsstm_current_media.pause();
        wpsstm_current_media.setSrc(new_player_source);
        wpsstm_current_media.load();
        wpsstm_current_media.play();

        //trackinfo
        var trackinfo_sources = jQuery(bottom_player_el).find('#wpsstm-player-sources-wrapper li');
        jQuery(trackinfo_sources).removeClass('wpsstm-active-source');

        var new_source_el = new_source_obj.get_player_source_el();
        jQuery(new_source_el).addClass('wpsstm-active-source');
    }
    
    skip_bad_source(media){
        
        console.log("WpsstmTrack:skip_bad_source()");
        
       //https://github.com/mediaelement/mediaelement/issues/2179#issuecomment-297090067
        
        var self = this;
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
            self.skip_bad_source(new_source_idx);
        }else{
            console.log("WpsstmTrack:skip_bad_source() - No valid sources found - go to next track if possible");
            var track_el = self.get_track_el();
            $(track_el).addClass('error');
            self.can_play = false;

            //No more sources - Play next song if any
            var tracklist = wpsstm_page_player.get_tracklist_obj(this.tracklist_idx);
            tracklist.play_next_track();
        }

    }
    
    end_track(){
        var self = this;
        var track_el    =   self.get_track_el();

        console.log("WpsstmTrack:end_track() #" + self.track_idx + " in playlist " + self.tracklist_idx);

        //mediaElement
        if (wpsstm_current_media){
            console.log("there is an active media, abord it");
            wpsstm_current_media.pause();
            self.update_button('ended');

        }
    }
    
}

class WpsstmTrackSource {
    constructor(source_html,track) {

        var self = this;
        self.tracklist_idx = track.tracklist_idx;
        self.track_idx = track.track_idx;
        self.source_idx = track.sources.length;
        jQuery(source_html).attr('data-wpsstm-source-idx',this.source_idx);
        
        self.src =    jQuery(source_html).find('a').attr('href');
        self.type =    jQuery(source_html).attr('data-wpsstm-source-type');
        
        //console.log("new WpsstmTrackSource #" + this.source_idx + " in track #" + track.track_idx + " from tracklist track #" + track.tracklist_idx);

    }

    get_player_source_el(){
        return jQuery(bottom_player_el).find('[data-wpsstm-source-idx="'+this.source_idx+'"]');
    }
    
    select_source_list(){
        var self = this;
        var track_obj = wpsstm_page_player.get_tracklist_track_obj(self.tracklist_idx,self.track_idx);

        var track_sources_count = track_obj.sources.length;
        if ( track_sources_count <= 1 ) return;
        
        console.log("clicked source #" + this.source_idx + " of track #" + this.track_idx + " in playlist #" + self.tracklist_idx);
        console.log(self);
        
        var player_source_el = self.get_player_source_el();
        var ul_el = player_source_el.closest('ul');

        var sources_list = player_source_el.closest('ul');
        var sources_list_wrapper = sources_list.closest('td.trackitem_sources');

        sources_list.closest('ul').append(player_source_el); //move it at the bottom

        if ( !player_source_el.hasClass('wpsstm-active-source') ){ //source switch

            var lis_el = player_source_el.closest('ul').find('li');
            lis_el.removeClass('wpsstm-active-source');
            player_source_el.addClass('wpsstm-active-source');

            track_obj.switch_track_source(self.source_idx);
        }

        ul_el.toggleClass('expanded');
    }

}

class WpsstmPagePlayer {
    constructor(){
        var self = this;
        
        console.log("new WpsstmPagePlayer()");
        self.track_playing;
        self.current_tracklist_idx;
        self.tracklists                 = [];
        self.tracklists_shuffle_order   = [];
        self.is_shuffle                 = ( localStorage.getItem("wpsstm-player-shuffle") == 'true' );
    }
    
    populate_tracklists(all_tracklists){
        
        var self = this;

        if ( jQuery(all_tracklists).length <= 0 ) return;

        jQuery(all_tracklists).each(function( i, tracklist_el ) {

            console.log("wpsstm_init_tracklists : new WpsstmTracklist #" + i);

            var tracklist = new WpsstmTracklist(tracklist_el,i);
            self.tracklists.push(tracklist);
            self.tracklists_shuffle_order.push(i);  

        });

        //shuffle
        self.tracklists_shuffle_order = wpsstm_shuffle(self.tracklists_shuffle_order);

        //autoplay first tracklist
        if ( wpsstmPlayer.autoplay ){
            var first_tracklist_obj = self.get_tracklist_obj(0);
            first_tracklist_obj.init_tracklist();
        }
    }

    get_tracklist_obj(tracklist_idx){

        if(typeof tracklist_idx === 'undefined'){
            tracklist_idx = this.current_tracklist_idx;
        }

        tracklist_idx = Number(tracklist_idx);
        var tracklist_obj = this.tracklists[tracklist_idx];
        if(typeof tracklist_obj === 'undefined') return false;
        return tracklist_obj;
    }
    
    get_tracklist_track_obj(tracklist_idx,track_idx){
        var tracklist_obj = this.get_tracklist_obj(tracklist_idx);
        if (!tracklist_obj) return false;
        var track_obj = tracklist_obj.get_track_obj(track_idx);
        if (!track_obj) return false;
        return track_obj;
    }

    get_maybe_shuffle_tracklist_idx(idx){
        var self = this;
        if ( !wpsstm_page_player.is_player_shuffle() ) return idx;
        var new_idx = self.tracklists_shuffle_order[idx];
        
        console.log("WpsstmPagePlayer:get_maybe_shuffle_tracklist_idx() : " + idx + "-->" + new_idx);
        return new_idx;
        
    }
    
    is_player_shuffle(){
        var self = this;
        return self.is_shuffle;
    }
    
}

function wpsstm_shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

wpsstm_page_player = new WpsstmPagePlayer();