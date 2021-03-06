(function($){

    $(document).ready(function(){
        
        //filter playlists
        $(document).on("keyup", '#wpsstm-playlists-filter', function(e){
            e.preventDefault();
            var playlistFilterWrapper = $(this).closest('#wpsstm-filter-playlists');
            var playlistAddWrapper = $(playlistFilterWrapper).find('#wpsstm-new-playlist-add');
            var value = $(this).val().toLowerCase();
            var li_items = playlistFilterWrapper.find('ul li');

            var has_results = false;
            $(li_items).each(function() {
                if ($(this).text().toLowerCase().search(value) > -1) {
                    $(this).show();
                    has_results = true;
                }
                else {
                    $(this).hide();
                }
            });

            if (has_results){
                playlistAddWrapper.hide();
            }else{
                playlistAddWrapper.show();
            }

        });
        
    });
    
    $(document).on( "wpsstmTrackDomReady", function( event, track_obj ) {
        var track_el = track_obj.track_el;

        //play button
        $(track_el).find('.wpsstm-play-track').click(function(e) {
            e.preventDefault();

            if ( wpsstm_mediaElement && $(track_el).hasClass('active') ){
                if ( $(track_el).hasClass('playing') ){
                    wpsstm_mediaElement.pause();
                }else{
                    wpsstm_mediaElement.play();
                }
            }else{
                self.play_tracklist_track(track_obj.track_idx);
            }

        });
        
        //favorite track
        $(track_el).find('#wpsstm-track-action-favorite a').click(function(e) {

            e.preventDefault();
            if ( !wpsstm_get_current_user_id() ) return;

            var link = $(this);

            var tracklist_el = link.closest('[data-wpsstm-tracklist-idx]');
            var tracklist_idx = tracklist_el.attr('data-wpsstm-tracklist-idx');

            var track_el = link.closest('[itemprop="track"]');
            var track_idx = track_el.attr('data-wpsstm-track-idx');

            var track_obj = wpsstm_page_player.get_tracklist_track_obj(tracklist_idx,track_idx);

            var ajax_data = {
                action:         'wpsstm_love_unlove_track',
                do_love:        true,
                post_id:        track_obj.post_id
            };

            return $.ajax({

                type:       "post",
                url:        wpsstmL10n.ajaxurl,
                data:       ajax_data,
                dataType:   'json',

                beforeSend: function() {
                    link.addClass('loading');
                },
                success: function(data){
                    if (data.success === false) {
                        console.log(data);
                    }else{
                        var track_instances = track_obj.get_track_instances();
                        track_instances.find('#wpsstm-track-action-favorite').removeClass('wpsstm-toggle-favorite-active');
                        track_instances.find('#wpsstm-track-action-unfavorite').addClass('wpsstm-toggle-favorite-active');
                    }
                },
                complete: function() {
                    link.removeClass('loading');
                    $(document).trigger( "wpsstmTrackLove", [track_obj,true] ); //register custom event - used by lastFM for the track.updateNowPlaying call
                }
            })

        });

        //unfavorite track
        $(track_el).find('#wpsstm-track-action-unfavorite a').click(function(e) {

            e.preventDefault();
            if ( !wpsstm_get_current_user_id() ) return;

            var link = $(this);

            var tracklist_el = link.closest('[data-wpsstm-tracklist-idx]');
            var tracklist_idx = tracklist_el.attr('data-wpsstm-tracklist-idx');

            var track_el = link.closest('[itemprop="track"]');
            var track_idx = track_el.attr('data-wpsstm-track-idx');

            var track_obj = wpsstm_page_player.get_tracklist_track_obj(tracklist_idx,track_idx);

            var ajax_data = {
                action:         'wpsstm_love_unlove_track',
                do_love:        false,
                post_id:        track_obj.post_id
            };

            return $.ajax({

                type:       "post",
                url:        wpsstmL10n.ajaxurl,
                data:       ajax_data,
                dataType:   'json',

                beforeSend: function() {
                    link.addClass('loading');
                },
                success: function(data){
                    if (data.success === false) {
                        console.log(data);
                    }else{
                        var track_instances = track_obj.get_track_instances();
                        track_instances.find('#wpsstm-track-action-favorite').addClass('wpsstm-toggle-favorite-active');
                        track_instances.find('#wpsstm-track-action-unfavorite').removeClass('wpsstm-toggle-favorite-active');
                    }
                },
                complete: function() {
                    link.removeClass('loading');
                    $(document).trigger( "wpsstmTrackLove", [track_obj,false] ); //register custom event - used by lastFM for the track.updateNowPlaying call
                }
            })

        });

    });
    
    $(document).on( "wpsstmTrackInit", function( event, track_obj ) {
        
        var track_el = track_obj.track_el;
        if ( track_el.is(":visible") ) return;
        
        var tracklist_el = track_obj.get_tracklist_el();
        var visibleTracksCount = tracklist_el.find('[itemprop="track"]:visible').length;
        var newTracksCount = track_obj.track_idx + 1;
        
        if ( newTracksCount <= visibleTracksCount ) return;
        
        tracklist_el.toggleTracklist({
            childrenMax:newTracksCount
        });
        
    });

    
    
    
})(jQuery);

class WpsstmTrack {
    constructor(track_html,tracklist_idx,track_idx) {

        var self =                  this;
        self.track_el =             $(track_html);
        self.tracklist_idx =        tracklist_idx; //cast to number;
        self.track_idx =            track_idx;
        self.artist =               self.track_el.find('[itemprop="byArtist"]').text();
        self.title =                self.track_el.find('[itemprop="name"]').text();
        self.album =                self.track_el.find('[itemprop="inAlbum"]').text();
        self.post_id =              self.track_el.attr('data-wpsstm-track-id');
        self.sources_request =      null;
        self.did_sources_request =  false;
        self.track_can_play =       true; //false when no source have been populated or that none are playable
        self.sources =              [];
        self.current_source_idx =   undefined;
        self.playback_start =       null; //seconds - used by lastFM
       
        //self.debug("new track");
        
        self.track_el.attr('data-wpsstm-track-idx',this.track_idx);
        
        //populate existing sources
        self.populate_html_sources();
        
        $(document).trigger("wpsstmTrackDomReady",[self]); //custom event

    }
    
    get_tracklist_el(){
        var self = this;
        return self.track_el.closest('[data-wpsstm-tracklist-idx="'+self.tracklist_idx+'"]');
    }
    
    debug(msg){
        var prefix = "WpsstmTrack #" + this.track_idx + " in playlist #"+ this.tracklist_idx +": ";
        wpsstm_debug(msg,prefix);
    }

    get_track_instances(ancestor){
        if (ancestor !== undefined){
            return $(ancestor).find('[data-wpsstm-tracklist-idx="'+this.tracklist_idx+'"] [itemprop="track"][data-wpsstm-track-idx="'+this.track_idx+'"]');
        }else{
            return $('[data-wpsstm-tracklist-idx="'+this.tracklist_idx+'"] [itemprop="track"][data-wpsstm-track-idx="'+this.track_idx+'"]');
        }
    }
    
    /*
    Update the track button after a media event.
    */

    updateTrackClasses(event){
        
        var self = this;
        //var player_track = self.get_track_instances('#wpsstm-bottom');
        var track_instances = self.get_track_instances();

        switch(event) {
            case 'loadeddata':
            break;
            case 'error':
                track_instances.addClass('error');
            break;
            case 'play':
                track_instances.addClass('playing');
                track_instances.addClass('has-played');
                track_instances.removeClass('error buffering ended');
                
            break;
            case 'pause':
                track_instances.removeClass('playing');
            break;
            case 'ended':
                track_instances.removeClass('playing');
                track_instances.removeClass('active');
                track_instances.removeClass('buffering');
            break;
        }

    }

    /*
    Initialize a track : either play it if it has sources; or get the sources then call this function again (with after_ajax = true)
    */

    play_or_skip(source_idx){

        var self = this;
        var tracklist_obj = wpsstm_page_player.get_tracklist_obj(self.tracklist_idx);

        //cannot play this track
        if (!self.track_can_play) {
            tracklist_obj.play_next_track();
            return;
        }

        self.playback_start = 0; //reset playback start
        
        wpsstm_currentTrack = self;
        
        var all_tracks = $('[itemprop="track"]');
        all_tracks.removeClass('active playing');
        
        var track_instances = self.get_track_instances();
        track_instances.addClass('active buffering');
        
        self.set_bottom_trackinfo();
        
        $(document).trigger( "wpsstmTrackInit",[self] ); //custom event
        
        var deferredObject = self.get_sources_auto();
        
        deferredObject.done(function() {
            
            //set a small timeout so track does not play if user fast skip tracks
            setTimeout(function(){
                
                if ( self != wpsstm_currentTrack ) return false; //track has been switched since we've requested it

                if ( self.sources.length > 0 ){
                    self.load_in_player(source_idx);
                }else{
                    tracklist_obj.play_next_track();
                }
                
            }, 1000);

        })
        
        deferredObject.fail(function() {
            
            if ( self != wpsstm_currentTrack ) return false; //track has been switched since we've requested it

            tracklist_obj.play_next_track();
        })

        deferredObject.always(function(data, textStatus, jqXHR) {
            
            if ( self != wpsstm_currentTrack ) return false; //track has been switched since we've requested it
            
            self.get_next_tracks_sources_auto();
        })

    }
    
    get_sources_auto(){

        var self = this;
        var tracklist_obj = wpsstm_page_player.get_tracklist_obj(self.tracklist_idx);

        var track_instances = self.get_track_instances();
        
        var deferredObject = $.Deferred();

        if ( self.sources.length > 0 ){ //we already have sources
            deferredObject.resolve();
        } else if ( !tracklist_obj.autosource ) {
            deferredObject.resolve();
            
        } else if ( self.did_sources_request ) {
            deferredObject.resolve();
        } else{
            
            self.debug("get_sources_auto");
            
            var promise = self.get_track_sources_request();
            track_instances.addClass('buffering');
            
            promise.fail(function() {

                track_instances.addClass('error');
                self.track_can_play = false;

                console.log("sources request failed for track #" + self.track_idx);
                
                deferredObject.reject();

            })
            
            promise.done(function() {
                self.debug("get_sources_auto - success");
                deferredObject.resolve();
            })
            
            promise.always(function(data, textStatus, jqXHR) {
                self.did_sources_request = true;
                track_instances.removeClass('buffering');
            })

        }

        return deferredObject.promise();
    }
    
    /*
    Init a sources request for this track and the X following ones (if not populated yet)
    */
    
    get_next_tracks_sources_auto() {

        var self = this;
        var tracklist = wpsstm_page_player.tracklists[self.tracklist_idx];

        self.debug("get_next_tracks_sources_auto");

        var max_items = wpsstm_track_source_requests_limit;
        var rtrack_in = self.track_idx + 1;
        var rtrack_out = self.track_idx + max_items + 1;

        var tracks_slice = $(tracklist.tracks).slice( rtrack_in, rtrack_out );

        $(tracks_slice).each(function(index, track_to_preload) {
            track_to_preload.get_sources_auto();
        });
    }
    
    set_bottom_audio_el(){
        
        var self = this;
        
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
    }
    
    set_bottom_trackinfo(){
        var self = this;
        //track infos
        
        var tracklist_el = self.get_tracklist_el();
        var bottom_tracklist_el = tracklist_el.clone();

        //copy attributes from the original playlist 
        var attributes = $(tracklist_el).prop("attributes");
        $.each(attributes, function() {
            $(bottom_trackinfo_el).attr(this.name, this.value);
        });
        
        var list = $('<ul class="wpsstm-tracklist-entries"></ul>');

        var row = self.track_el.clone(true,true);
        $(list).append(row);

        $(bottom_trackinfo_el).html(list);
        
        $(bottom_el).show();//show in not done yet
    }

    load_in_player(source_idx){
        
        var self = this;

        self.set_bottom_audio_el(); //build <audio/> el
        self.debug("load_in_player");
        
        var audio_el = $('#wpsstm-player-audio');

        $(audio_el).mediaelementplayer({
            classPrefix: 'mejs-',
            // All the config related to HLS
            hls: {
                debug:          wpsstmL10n.debug,
                autoStartLoad:  true
            },
            // Do not forget to put a final slash (/)
            pluginPath: 'https://cdnjs.com/libraries/mediaelement/',
            //audioWidth: '100%',
            stretching: 'responsive',
            features: ['playpause','loop','progress','current','duration','volume'],
            loop: false,
            success: function(mediaElement, originalNode, player) {

                wpsstm_mediaElementPlayer = player;
                wpsstm_mediaElement = mediaElement;

                //handle source
                self.set_track_source(source_idx);
                
                self.debug("wpsstmMediaReady");
                $(document).trigger( "wpsstmMediaReady",[wpsstm_mediaElement,self] ); //custom event

                wpsstm_mediaElement.addEventListener('error', function(error) {
                    var source_obj = self.get_track_source(self.current_source_idx);
                    console.log('player event - source error for source: '+self.current_source_idx);
                    //self.debug(error);
                    self.updateTrackClasses('loadeddata');
                    self.skip_bad_source(self.current_source_idx);

                });

                wpsstm_mediaElement.addEventListener('loadeddata', function() {
                    self.debug('player event - loadeddata');
                    self.updateTrackClasses('loadeddata');
                    wpsstm_mediaElement.play();
                });

                wpsstm_mediaElement.addEventListener('play', function() {
                    
                    if (!self.playback_start){
                        self.playback_start = Math.round( $.now() /1000);
                    }

                    self.debug('player event - play');
                    self.updateTrackClasses('play');
                });

                wpsstm_mediaElement.addEventListener('pause', function() {
                    self.debug('player - pause');
                    self.updateTrackClasses('pause');
                });

                wpsstm_mediaElement.addEventListener('ended', function() {
                    self.debug('MediaElement.js event - ended');
                    self.updateTrackClasses('ended');
                    wpsstm_mediaElement = undefined;
                    
                    //Play next song if any
                    var tracklist_obj = wpsstm_page_player.get_tracklist_obj(self.tracklist_idx);
                    tracklist_obj.play_next_track();
                });

            },error(mediaElement) {
                // Your action when mediaElement had an error loading
                //TO FIX is this required ?
                console.log("mediaElement error");
            }
        });

    }

    get_track_sources_request() {

        var self = this;
        
        var track_el    = self.get_track_instances();
        $(track_el).find('.trackitem_sources').html('');
        
        var deferredObject = $.Deferred();

        //self.debug("get_track_sources_request()");

        var ajax_data = {
            action:           'wpsstm_autosources_list',
            post_id:          self.post_id
        };
        
        self.sources_request = $.ajax({
            type:       "post",
            url:        wpsstmL10n.ajaxurl,
            data:       ajax_data,
            dataType:   'json',
        });

        self.sources_request.done(function(data) {

            if ( (data.success === true) && ( data.new_html ) ){
                $(track_el).find('.trackitem_sources').html(data.new_html); //append new sources
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
        var track_el =  self.track_el; //page track

        var new_sources_items = $(track_el).find('.trackitem_sources li');

        //self.debug("found "+new_sources_items.length +" sources");
        
        self.sources = [];
        $.each(new_sources_items, function( index, li_item ) {
            var new_source = new WpsstmTrackSource(li_item,self);
            self.sources.push(new_source);            
        });

        if (self.sources.length){ //we've got sources
            self.track_can_play = true;
            //self.debug("populate_html_sources(): " +self.sources.length);
            $(document).trigger("wpsstmTrackSourcesDomReady",[self]); //custom event
        }

        $(track_el).attr('data-wpsstm-sources-count',self.sources.length);
        
        
        
    }
    
    get_track_source(source_idx){
        var self = this;

        source_idx = Number(source_idx);
        var source_obj = self.sources[source_idx];
        if(typeof source_obj === 'undefined') return;
        return source_obj;
    }
    
    highligh_source(idx){
        var self = this;
        
        self.debug("highligh_source(): #" + idx);
        
        var source_obj = self.get_track_source(idx);
        var track_instances = self.get_track_instances();
        var trackinfo_sources = track_instances.find('.wpsstm-track-sources-list li');
        $(trackinfo_sources).removeClass('wpsstm-active-source');

        var source_li = source_obj.get_source_li_el();
        $(source_li).addClass('wpsstm-active-source');
    }
    
    set_track_source(idx){
        var self = this;
        
        if (idx === undefined) idx = 0;

        var new_source_obj = self.get_track_source(idx);
        var new_source = { src: new_source_obj.src, 'type': new_source_obj.type };

        if (self.current_source_idx == idx){
            self.debug("source #"+idx+" is already set");
            return false;
        }

        self.debug("set_track_source() #" + idx);
        new_source_obj.get_source_li_el().addClass('wpsstm-active-source');

        //player
        wpsstm_mediaElement.pause();
        wpsstm_mediaElement.setSrc(new_source.src);
        wpsstm_mediaElement.load();
        
        self.current_source_idx = idx;
        self.highligh_source(idx);

    }
    
    skip_bad_source(source_idx){
        //https://github.com/mediaelement/mediaelement/issues/2179#issuecomment-297090067
        
        var self = this;
        var source_obj = self.get_track_source(source_idx);
        
        self.debug("skip_bad_source(): #" + source_idx + ": " +source_obj.src);

        source_obj.source_can_play = false;
        self.current_source_idx = undefined;
        
        var source_el = source_obj.get_source_li_el();
        source_el.removeClass('wpsstm-active-source').addClass('wpsstm-bad-source');
        
        //
        var new_source_idx;
        
        //make a reordered array of sources
        var sources_before = self.sources.slice(0,source_idx);
        var sources_after = self.sources.slice(source_idx+1); //do not including this one
        var sources_reordered = sources_after.concat(sources_before);

        $( sources_reordered ).each(function(i, source_attr) {
            if (!source_attr.source_can_play) return true; //continue;
            new_source_idx = source_attr.source_idx;
            return false;//break
        });
        
        if (new_source_idx !== undefined){
            
            self.set_track_source(new_source_idx);
            
        }else{
           
            if (!self.did_sources_request){
                self.debug("skip_bad_source() - No valid sources found but no sources requested yet - unset sources and try again");
                self.debug(self);
                
                self.sources = []; //unset sources so autosource will work

                //try again
                self.play_or_skip();
                return;
                
            }else{
                self.debug("skip_bad_source() - No valid sources found - go to next track if possible");
                var track_instances = self.get_track_instances();
                track_instances.addClass('error');
                self.track_can_play = false;

                //No more sources - Play next song if any
                var tracklist = wpsstm_page_player.get_tracklist_obj(this.tracklist_idx);
                tracklist.play_next_track();
            }
           
       }

    }

}