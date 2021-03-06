<?php

class WP_SoundSystem_Core_Tracks{

    public $title_metakey = '_wpsstm_track';
    public $qvar_track_admin = 'admin';
    public $qvar_track_lookup = 'lookup_track';
    public $track_mbtype = 'recording'; //musicbrainz type, for lookups
    
    public $subtracks_hide = true; //default hide subtracks in track listings
    public $favorited_track_meta_key = '_wpsstm_user_favorite';

    /**
    * @var The one true Instance
    */
    private static $instance;

    public static function instance() {
            if ( ! isset( self::$instance ) ) {
                    self::$instance = new WP_SoundSystem_Core_Tracks;
                    self::$instance->init();
            }
            return self::$instance;
    }
    
    private function __construct() { /* Do nothing here */ }
    
    function init(){
        add_action( 'wpsstm_loaded',array($this,'setup_globals') );
        add_action( 'wpsstm_loaded',array($this,'setup_actions') );
    }
    
    function setup_globals(){
        
        if ( isset($_REQUEST['wpsstm_subtracks_hide']) ){
            $this->subtracks_hide = ($_REQUEST['wpsstm_subtracks_hide'] == 'on') ? true : false;
        }elseif ( $subtracks_hide_db = get_option('wpsstm_subtracks_hide') ){
            $this->subtracks_hide = ($subtracks_hide_db == 'on') ? true : false;
        }
    }

    function setup_actions(){

        add_action( 'init', array($this,'register_post_type_track' ));
        
        add_filter( 'query_vars', array($this,'add_query_vars_track') );
        
        add_action( 'init', array($this,'register_track_endpoints' ));
        
        add_filter( 'template_include', array($this,'track_admin_template_filter'));
        add_action( 'wp', array($this,'track_save_admin_gui'));
        
        add_action( 'wp_enqueue_scripts', array( $this, 'register_tracks_scripts_styles_shared' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'register_tracks_scripts_styles_shared' ) );
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_tracks_scripts_styles_frontend' ) );
        add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_tracks_scripts_styles_backend' ) );
        
        add_filter( 'pre_get_posts', array($this,'pre_get_posts_by_track_title') );
        add_action( 'save_post', array($this,'update_title_track'), 99);

        add_action( 'add_meta_boxes', array($this, 'metabox_track_register'));
        add_action( 'save_post', array($this,'metabox_track_title_save'), 5);
        
        add_filter('manage_posts_columns', array($this,'tracks_column_lovedby_register'), 10, 2 );
        add_action( 'manage_posts_custom_column', array($this,'tracks_column_lovedby_content'), 10, 2 );
        add_filter( sprintf("views_edit-%s",wpsstm()->post_type_track), array(wpsstm(),'register_community_view') );

        //tracklist shortcode
        add_shortcode( 'wpsstm-track',  array($this, 'shortcode_track'));
        
        //subtracks
        add_filter( 'pre_get_posts', array($this,'pre_get_posts_subtracks') );
        add_filter( 'posts_orderby', array($this,'sort_subtracks_by_position'), 10, 2 );
        
        /*
        add_action( 'admin_notices',  array($this, 'toggle_subtracks_notice') );
        add_action( 'current_screen',  array($this, 'toggle_subtracks_store_option') );
        add_filter( 'pre_get_posts', array($this,'default_exclude_subtracks') );
        */
        
        //delete sources when post is deleted
        add_action( 'wp_trash_post', array($this,'trash_track_sources') );
        
        //ajax : toggle love track
        add_action('wp_ajax_wpsstm_love_unlove_track', array($this,'ajax_love_unlove_track'));

        //ajax : add new tracklist
        add_action('wp_ajax_wpsstm_append_to_new_playlist', array($this,'ajax_append_to_new_playlist'));
        
        //ajax : add/remove playlist track
        add_action('wp_ajax_wpsstm_add_playlist_track', array($this,'ajax_add_playlist_track'));
        add_action('wp_ajax_wpsstm_remove_playlist_track', array($this,'ajax_remove_playlist_track'));

    }
    
    function register_track_endpoints(){
        // (existing track) admin
        add_rewrite_endpoint($this->qvar_track_admin, EP_PERMALINK ); 
    }
    
    function register_tracks_scripts_styles_shared(){
        //CSS
        wp_register_style( 'wpsstm-tracks', wpsstm()->plugin_url . '_inc/css/wpsstm-tracks.css', array('font-awesome','thickbox','wpsstm-track-sources'),wpsstm()->version );
        //JS
        wp_register_script( 'wpsstm-tracks', wpsstm()->plugin_url . '_inc/js/wpsstm-tracks.js', array('jquery','thickbox','wpsstm-track-sources'),wpsstm()->version );
        
    }
    
    function enqueue_tracks_scripts_styles_frontend(){
        //TO FIX load only when single track is displayed ? but anyway is loaded through wpsstm-tracklists ?
        wp_enqueue_style( 'wpsstm-tracks' );
        wp_enqueue_script( 'wpsstm-tracks' );
        
    }

    function enqueue_tracks_scripts_styles_backend(){
        
        if ( !wpsstm()->is_admin_page() ) return;
        
        wp_enqueue_script( 'wpsstm-tracks' );
        wp_enqueue_style( 'wpsstm-tracks' );

    }
    
    /**
    *    From http://codex.wordpress.org/Template_Hierarchy
    *
    *    Adds a custom template to the query queue.
    */
    
    function track_admin_template_filter($template){
        global $wp_query;
        global $post;

        $post_type = get_post_type($post);
        $track_admin_action =  get_query_var( $this->qvar_track_admin );
        $tracklist_admin_action =  get_query_var( wpsstm_tracklists()->qvar_tracklist_admin );

        $is_track_edit = ( $track_admin_action && ($post_type == wpsstm()->post_type_track) );
        $is_tracklist_new_track = ( ($tracklist_admin_action == 'new-subtrack') && in_array($post_type,wpsstm_tracklists()->static_tracklist_post_types) );

        if ( !$is_track_edit && !$is_tracklist_new_track ) return $template;

        if ( $template = wpsstm_locate_template( 'track-admin.php' ) ){

            //TO FIX should be registered in register_tracks_scripts_styles_shared() then enqueued here, but it is not working
            wp_enqueue_script( 'wpsstm-track-admin', wpsstm()->plugin_url . '_inc/js/wpsstm-track-admin.js', array('jquery','jquery-ui-tabs'),wpsstm()->version, true );
            add_filter( 'body_class', array($this,'track_popup_body_classes'));
        }
        
        return $template;
    }
    
    function track_popup_body_classes($classes){
        $classes[] = 'wpsstm_track-template-admin';
        return $classes;
    }
    
    function track_save_admin_gui(){
        global $post;
        global $wp_query;

        $post_type = get_post_type();
        if ( $post_type != wpsstm()->post_type_track ) return;
        
        $track = new WP_SoundSystem_Track($post->ID);
        $popup_action = ( isset($_POST['wpsstm-admin-track-action']) ) ? $_POST['wpsstm-admin-track-action'] : null;
        if ( !$popup_action ) return;

        switch($popup_action){

            case 'edit':
                
                //nonce check
                if ( !isset($_POST['wpsstm_admin_track_gui_edit_nonce']) || !wp_verify_nonce($_POST['wpsstm_admin_track_gui_edit_nonce'], 'wpsstm_admin_track_gui_edit_'.$track->post_id ) ) {
                    wpsstm()->debug_log(array('track_id'=>$track->post_id,'track_gui_action'=>$popup_action),"invalid nonce"); 
                    break;
                }

                $track->artist = ( isset($_POST[ 'wpsstm_track_artist' ]) ) ? $_POST[ 'wpsstm_track_artist' ] : null;
                $track->title = ( isset($_POST[ 'wpsstm_track_title' ]) ) ? $_POST[ 'wpsstm_track_title' ] : null;
                $track->album = ( isset($_POST[ 'wpsstm_track_album' ]) ) ? $_POST[ 'wpsstm_track_album' ] : null;
                $track->mbid = ( isset($_POST[ 'wpsstm_track_mbid' ]) ) ? $_POST[ 'wpsstm_track_mbid' ] : null;

                $track->save_track();
                
            break;
            case 'sources':

                //nonce check
                if ( !isset($_POST['wpsstm_admin_track_gui_sources_nonce']) || !wp_verify_nonce($_POST['wpsstm_admin_track_gui_sources_nonce'], 'wpsstm_admin_track_gui_sources_'.$track->post_id ) ) {
                    wpsstm()->debug_log(array('track_id'=>$track->post_id,'track_gui_action'=>$popup_action),"invalid nonce"); 
                    break;
                }
                
                $sources_raw = ( isset($_POST[ 'wpsstm_track_sources' ]) ) ? $_POST[ 'wpsstm_track_sources' ] : array();

                foreach((array)$sources_raw as $source_raw){
                    
                    if ( isset($source_raw['post_id']) ){
                        $source = new WP_SoundSystem_Source($source_raw['post_id']);
                    }else{
                        $source = new WP_SoundSystem_Source();
                        
                        $source_raw['track_id'] = $track->post_id;
                        $source->populate_array( $source_raw );
                        if (!$source->url) continue;
                    }

                    if ($source->post_id){ //confirm source by updating its author
                        
                        wp_update_post(array(
                            'ID' =>             $source->post_id,
                            'post_author' =>    get_current_user_id()
                        ));
                        
                    }else{ //add source
                        
                        $source->save_source();
                        
                    }
                    
                }
                
            break;
        }
    }
    
    /*
    Display a notice (and link) to toggle view subtracks
    */
    
    function toggle_subtracks_notice(){
        
        $screen = get_current_screen();

        if ( $screen->post_type != wpsstm()->post_type_track ) return;
        if ( $screen->base != 'edit' ) return;
        
        $toggle_value = ($this->subtracks_hide) ? 'off' : 'on';
        
        $link = admin_url('edit.php');
        $post_status = ( isset($_REQUEST['post_status']) ) ? $_REQUEST['post_status'] : null;
        
        if ( $post_status ){
            $link = add_query_arg(array('post_status'=>$post_status),$link);
        }
        
        $link = add_query_arg(array('post_type'=>wpsstm()->post_type_track,'wpsstm_subtracks_hide'=>$toggle_value),$link);

        $notice_link = sprintf( '<a href="%s">%s</a>',$link,__('here','wpsstm') );
        
        $notice = null;
        
        if ($this->subtracks_hide){
            $notice = sprintf(__('Click %s if you want to include subtracks (tracks belonging to albums or (live) playlists) in this listing.','wpsstm'),$notice_link);
        }else{
            $notice = sprintf(__('Click %s if you want to exclude subtracks (tracks belonging to albums or (live) playlists) from this listing.','wpsstm'),$notice_link);
        }

        printf('<div class="notice notice-warning"><p>%s</p></div>',$notice);

    }
    
    /*
    Toggle view subtracks : store option then redirect
    */
    
    function toggle_subtracks_store_option($screen){
        
        if ( $screen->post_type != wpsstm()->post_type_track ) return;
        if ( $screen->base != 'edit' ) return;
        if ( !isset($_REQUEST['wpsstm_subtracks_hide']) ) return;
        
        $value = $_REQUEST['wpsstm_subtracks_hide'];

        update_option( 'wpsstm_subtracks_hide', $value );
        
        $this->subtracks_hide = ($value == 'on') ? true : false;

    }
    
    //TO FIX caution with this, will exclude tracks backend to.
    //We should find a way to run it only for backend listings.
    function default_exclude_subtracks( $query ) {

        //only for main query
        if ( !$query->is_main_query() ) return $query;
        
        //only for tracks
        if ( $query->get('post_type') != wpsstm()->post_type_track ) return $query;
        
        //already defined
        if ( $query->get('subtracks_exclude') ) return $query;
        
        //option enabled ?
        if ($this->subtracks_hide){
            $query->set('subtracks_exclude',true);
        }

        return $query;
    }
    
    function tracks_column_lovedby_register($defaults) {
        global $post;

        $allowed_post_types = array(
            wpsstm()->post_type_track
        );
        
        $before = array();
        $after = array();
        
        if ( isset($_GET['post_type']) && in_array($_GET['post_type'],$allowed_post_types) ){
            $after['track-lovedby'] = __('Loved by:','wpsstm');
        }
        
        return array_merge($before,$defaults,$after);
    }
    

    
    function tracks_column_lovedby_content($column,$post_id){
        global $post;
        
        switch ( $column ) {
            case 'track-lovedby':
                $output = '—';
                $track = new WP_SoundSystem_Track($post_id);
                if ( $list = $track->get_loved_by_list() ){
                    $output = $list;
                }
                echo $output;
            break;
        }
    }

    function pre_get_posts_by_track_title( $query ) {

        if ( $track = $query->get( $this->qvar_track_lookup ) ){

            $query->set( 'meta_query', array(
                array(
                     'key'     => $this->title_metakey,
                     'value'   => $track,
                     'compare' => '='
                )
            ));
        }

        return $query;
    }
    
    /**
    Update the post title to match the artist/album/track, so we still have a nice post permalink
    **/
    
    function update_title_track( $post_id ) {
        
        //only for tracks
        if (get_post_type($post_id) != wpsstm()->post_type_track) return;

        //check capabilities
        $is_autosave = ( ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) || wp_is_post_autosave($post_id) );
        $is_autodraft = ( get_post_status( $post_id ) == 'auto-draft' );
        $is_revision = wp_is_post_revision( $post_id );
        $has_cap = current_user_can('edit_post', $post_id);
        if ( $is_autosave || $is_autodraft || $is_revision || !$has_cap ) return;

        $title = wpsstm_get_post_track($post_id);
        $artist = wpsstm_get_post_artist($post_id);
        
        if (!$title || !$artist) return;
        
        $post_title = sanitize_text_field( sprintf('%s - "%s"',$artist,$title) );

        //no changes - use get_post_field here instead of get_the_title() so title is not filtered
        if ( $post_title == get_post_field('post_title',$post_id) ) return;

        //log
        wpsstm()->debug_log(array('post_id'=>$post_id,'post_title'=>$post_title),"update_title_track()"); 

        $args = array(
            'ID'            => $post_id,
            'post_title'    => $post_title
        );

        remove_action( 'save_post',array($this,'update_title_track'), 99 ); //avoid infinite loop - ! hook priorities
        wp_update_post( $args );
        add_action( 'save_post',array($this,'update_title_track'), 99 );

    }

    function register_post_type_track() {

        $labels = array(
            'name'                  => _x( 'Tracks', 'Tracks General Name', 'wpsstm' ),
            'singular_name'         => _x( 'Track', 'Track Singular Name', 'wpsstm' ),
            'menu_name'             => __( 'Tracks', 'wpsstm' ),
            'name_admin_bar'        => __( 'Track', 'wpsstm' ),
            'archives'              => __( 'Track Archives', 'wpsstm' ),
            'attributes'            => __( 'Track Attributes', 'wpsstm' ),
            'parent_item_colon'     => __( 'Parent Track:', 'wpsstm' ),
            'all_items'             => __( 'All Tracks', 'wpsstm' ),
            'add_new_item'          => __( 'Add New Track', 'wpsstm' ),
            //'add_new'               => __( 'Add New', 'wpsstm' ),
            'new_item'              => __( 'New Track', 'wpsstm' ),
            'edit_item'             => __( 'Edit Track', 'wpsstm' ),
            'update_item'           => __( 'Update Track', 'wpsstm' ),
            'view_item'             => __( 'View Track', 'wpsstm' ),
            'view_items'            => __( 'View Tracks', 'wpsstm' ),
            'search_items'          => __( 'Search Tracks', 'wpsstm' ),
            //'not_found'             => __( 'Not found', 'wpsstm' ),
            //'not_found_in_trash'    => __( 'Not found in Trash', 'wpsstm' ),
            //'featured_image'        => __( 'Featured Image', 'wpsstm' ),
            //'set_featured_image'    => __( 'Set featured image', 'wpsstm' ),
            //'remove_featured_image' => __( 'Remove featured image', 'wpsstm' ),
            //'use_featured_image'    => __( 'Use as featured image', 'wpsstm' ),
            'insert_into_item'      => __( 'Insert into track', 'wpsstm' ),
            'uploaded_to_this_item' => __( 'Uploaded to this track', 'wpsstm' ),
            'items_list'            => __( 'Tracks list', 'wpsstm' ),
            'items_list_navigation' => __( 'Tracks list navigation', 'wpsstm' ),
            'filter_items_list'     => __( 'Filter tracks list', 'wpsstm' ),
        );

        $args = array( 
            'labels' => $labels,
            'hierarchical' => false,

            'supports' => array( 'author','title','thumbnail', 'comments' ),
            'taxonomies' => array( 'post_tag' ),
            'public' => true,
            'show_ui' => true,
            'show_in_menu' => false,
            'show_in_nav_menus' => true,
            'publicly_queryable' => true,
            'exclude_from_search' => false,
            'has_archive' => true,
            'query_var' => true,
            'can_export' => true,
            'rewrite' => true,
            //http://justintadlock.com/archives/2013/09/13/register-post-type-cheat-sheet
            'capability_type' => 'post', //track
            //'map_meta_cap'        => true,
            /*
            'capabilities' => array(

                // meta caps (don't assign these to roles)
                'edit_post'              => 'edit_track',
                'read_post'              => 'read_track',
                'delete_post'            => 'delete_track',

                // primitive/meta caps
                'create_posts'           => 'create_tracks',

                // primitive caps used outside of map_meta_cap()
                'edit_posts'             => 'edit_tracks',
                'edit_others_posts'      => 'manage_tracks',
                'publish_posts'          => 'manage_tracks',
                'read_private_posts'     => 'read',

                // primitive caps used inside of map_meta_cap()
                'read'                   => 'read',
                'delete_posts'           => 'manage_tracks',
                'delete_private_posts'   => 'manage_tracks',
                'delete_published_posts' => 'manage_tracks',
                'delete_others_posts'    => 'manage_tracks',
                'edit_private_posts'     => 'edit_tracks',
                'edit_published_posts'   => 'edit_tracks'
            ),
            */
        );

        register_post_type( wpsstm()->post_type_track, $args );
    }
    
    function add_query_vars_track( $qvars ) {
        $qvars[] = $this->qvar_track_lookup;
        $qvars[] = $this->qvar_track_admin;
        return $qvars;
    }
    
    function metabox_track_register(){
        
        $metabox_post_types = array(
            wpsstm()->post_type_track
        );

        add_meta_box( 
            'wpsstm-track', 
            __('Track','wpsstm'),
            array($this,'metabox_track_content'),
            $metabox_post_types, 
            'after_title', 
            'high' 
        );
        
    }
    
    function metabox_track_content( $post ){

        $track_title = get_post_meta( $post->ID, $this->title_metakey, true );
        
        ?>
        <input type="text" name="wpsstm_track" class="wpsstm-fullwidth" value="<?php echo $track_title;?>" placeholder="<?php printf("Enter track title here",'wpsstm');?>"/>
        <?php
        wp_nonce_field( 'wpsstm_track_meta_box', 'wpsstm_track_meta_box_nonce' );

    }
    

    
    function mb_populate_trackid( $post_id ) {
        
        $is_autosave = ( ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) || wp_is_post_autosave($post_id) );
        $is_autodraft = ( get_post_status( $post_id ) == 'auto-draft' );
        $is_revision = wp_is_post_revision( $post_id );
        if ( $is_autosave || $is_autodraft || $is_revision ) return;
        
        //already had an MBID
        //$trackid = wpsstm_get_post_mbid($post_id);
        //if ($trackid) return;

        //requires a title
        $track = wpsstm_get_post_track($post_id);
        if (!$track) return;
        
        //requires an artist
        $artist = wpsstm_get_post_artist($post_id);
        if (!$artist) return;

        
    }
    
    /**
    Save track field for this post
    **/
    
    function metabox_track_title_save( $post_id ) {

        //check save status
        $is_autosave = ( ( defined('DOING_AUTOSAVE') && DOING_AUTOSAVE ) || wp_is_post_autosave($post_id) );
        $is_autodraft = ( get_post_status( $post_id ) == 'auto-draft' );
        $is_revision = wp_is_post_revision( $post_id );
        $is_metabox = isset($_POST['wpsstm_track_meta_box_nonce']);
        if ( !$is_metabox || $is_autosave || $is_autodraft || $is_revision ) return;
        
        //check post type
        $post_type = get_post_type($post_id);
        $allowed_post_types = array(wpsstm()->post_type_track);
        if ( !in_array($post_type,$allowed_post_types) ) return;

        //nonce
        $is_valid_nonce = ( wp_verify_nonce( $_POST['wpsstm_track_meta_box_nonce'], 'wpsstm_track_meta_box' ) );
        if ( !$is_valid_nonce ) return;
        
        //this should run only once (for the main post); so unset meta box nonce.
        //without this the function would be called for every subtrack if there was some.
        unset($_POST['wpsstm_track_meta_box_nonce']);

        $track = ( isset($_POST[ 'wpsstm_track' ]) ) ? $_POST[ 'wpsstm_track' ] : null;

        if (!$track){
            delete_post_meta( $post_id, $this->title_metakey );
        }else{
            update_post_meta( $post_id, $this->title_metakey, $track );
        }

    }
    
    function shortcode_track( $atts ) {
        global $post;

        // Attributes
        $default = array(
            'post_id'       => $post->ID 
        );
        $atts = shortcode_atts($default,$atts);

        $tracklist = wpsstm_get_post_tracklist($atts['post_id']);
        
        return $tracklist->get_tracklist_table();

    }
    
    function ajax_love_unlove_track(){

        $ajax_data = wp_unslash($_POST);

        $result = array(
            'input'     => $ajax_data,
            'message'   => null,
            'success'   => false
        );

        $do_love = $result['do_love'] = ( isset($ajax_data['do_love']) ) ? filter_var($ajax_data['do_love'], FILTER_VALIDATE_BOOLEAN) : null; //ajax do send strings

        $track = new WP_SoundSystem_Track($ajax_data['post_id']);

        if ( ($do_love!==null) ){
            
            $success = $track->love_track($do_love);
            $result['track'] = $track;
            wpsstm()->debug_log( json_encode($track,JSON_UNESCAPED_UNICODE), "ajax_love_unlove_track()"); 

            if( is_wp_error($success) ){
                $code = $success->get_error_code();
                $result['message'] = $success->get_error_message($code); 
            }else{
                $result['success'] = $success; 
            }
        }

        header('Content-type: application/json');
        wp_send_json( $result ); 
    }

    function ajax_append_to_new_playlist(){
        $ajax_data = wp_unslash($_POST);

        wpsstm()->debug_log($ajax_data,"ajax_append_to_new_playlist()");

        $result = array(
            'input'     => $ajax_data,
            'message'   => null,
            'success'   => false,
            'new_html'  => null
        );

        $tracklist_title = $result['tracklist_title'] = ( isset($ajax_data['playlist_title']) ) ? trim($ajax_data['playlist_title']) : null;
        $track_id = $result['track_id'] = ( isset($ajax_data['track_id']) ) ? $ajax_data['track_id'] : null;

        $playlist = wpsstm_get_post_tracklist();
        $playlist->title = $tracklist_title;
        
        $tracklist_id = $playlist->save_playlist();

        if ( is_wp_error($tracklist_id) ){
            
            $code = $tracklist_id->get_error_code();
            $result['message'] = $tracklist_id->get_error_message($code);
            
        }else{

            $parent_ids = null;
            $result['playlist_id'] = $tracklist_id;
            $result['success'] = true;
            
            if ($track_id){
                
                $track = new WP_SoundSystem_Track($track_id);
                $append_success = $playlist->append_subtrack_ids($track->post_id);
                $parent_ids = $track->get_parent_ids();
                
            }

            $list_all = wpsstm_get_user_playlists_list(array('checked_ids'=>$parent_ids));
            
            $result['new_html'] = $list_all;

        }

        header('Content-type: application/json');
        wp_send_json( $result ); 
        
    }
    
    function ajax_add_playlist_track(){
        $ajax_data = wp_unslash($_POST);
        
        wpsstm()->debug_log($ajax_data,"ajax_add_playlist_track()"); 

        $result = array(
            'input'     => $ajax_data,
            'message'   => null,
            'success'   => false,
            'new_html'  => null
        );
        
        $post_id = isset($ajax_data['post_id']) ? $ajax_data['post_id'] : null;
        $playlist_id  = isset($ajax_data['playlist_id']) ? $ajax_data['playlist_id'] : null;
        
        if ($post_id && $playlist_id){
            
            $tracklist = new WP_SoundSystem_Tracklist($playlist_id);
            $track = new WP_SoundSystem_Track( $post_id );

            wpsstm()->debug_log($track,"ajax_add_playlist_track()");

            $result['track_id'] = $track->post_id;
            $success = $tracklist->append_subtrack_ids($track->post_id);

            if ( is_wp_error($success) ){
                $code = $success->get_error_code();
                $result['message'] = $success->get_error_message($code);
            }else{
                $result['success'] = $success;
            }
            
        }
   
        header('Content-type: application/json');
        wp_send_json( $result ); 
    }
    
    function ajax_remove_playlist_track(){
        $ajax_data = wp_unslash($_POST);

        $result = array(
            'input'     => $ajax_data,
            'message'   => null,
            'success'   => false,
            'new_html'  => null
        );
        
        $post_id = isset($ajax_data['post_id']) ? $ajax_data['post_id'] : null;
        $playlist_id = $result['playlist_id'] = isset($ajax_data['playlist_id']) ? $ajax_data['playlist_id'] : null;
        
        if ($post_id && $playlist_id){
            
            $tracklist = new WP_SoundSystem_Tracklist($playlist_id);
            $track = new WP_SoundSystem_Track( $post_id );

            //wpsstm()->debug_log($track,"ajax_remove_playlist_track()"); 

            $success = $tracklist->remove_subtrack_ids($track->post_id);

            if ( is_wp_error($success) ){
                $result['message'] = $success->get_error_message();
            }else{
                $result['success'] = $success;
            }
        }

        
        header('Content-type: application/json');
        wp_send_json( $result ); 
    }
    
    function trash_track_sources($post_id){
        
        if ( get_post_type($post_id) != wpsstm()->post_type_track ) return;
        
        //get all sources
        $source_ids = wpsstm_get_track_source_ids($post_id);
        
        foreach((array)$source_ids as $source_id){
            $success = wp_trash_post($source_id);
        }

    }
    
    /*
    Include or exclude subtracks from tracks queries.
    Subtrack type can be 'static', 'live' or true (both).
    
    include & true : returns all substracks
    include & live|static : returns live|static substracks
    
    exclude & true : return all tracks that are not subtracks
    exclude & live|static : return all tracks that are not live|static substracks
.   */
    
    function pre_get_posts_subtracks( $query ) {

        //only for tracks
        if ( $query->get('post_type') != wpsstm()->post_type_track ) return $query;
        
        $type = true;
        $include = null;

        $include_type = $query->get('subtracks_include');
        $exclude_type = $query->get('subtracks_exclude');

        if($include_type){
            $type = $include_type;
            $include = true;
        }elseif($exclude_type){
            $type = $exclude_type;
            $include = false;
        }else{ //cannot process
            return;
        }

        $tracklist_id = $query->get('tracklist_id');
        $subtrack_ids = wpsstm_get_subtrack_ids($type,$tracklist_id);
        
        /*
        filter subtracks to get only the orphans.
        if $tracklist_id is defined; that tracklist will NOT be considered as a subtrack parent.
        This is useful to get the flushable subtracks for a live tracklist.
        */
        
        $orphans = $query->get('subtracks_orphan');

        if ($orphans){

            $ignore_parent_id = ($tracklist_id) ? $tracklist_id : null;
            
            foreach ((array)$subtrack_ids as $key=>$track_id){

                $track = new WP_SoundSystem_Track($track_id);
                $parent_ids = (array)$track->get_parent_ids();
                $loved_by = $track->get_track_loved_by();

                //ignore parent ID
                if( $ignore_parent_id && ($ignore_parent_key = array_search($ignore_parent_id, $parent_ids)) !== false) unset($parent_ids[$ignore_parent_key]);

                //is not an orphan
                if ( !empty($parent_ids) || !empty($loved_by) ) unset($subtrack_ids[$key]);

            }

        }

        if ($include){
            
            //if we want to include subtracks and that there is none, force return nothing
            //https://core.trac.wordpress.org/ticket/28099
            //https://wordpress.stackexchange.com/a/140727/70449
            if (!$subtrack_ids){ 
                $subtrack_ids[] = array(0);
            }
            
            $query->set('post__in',(array)$subtrack_ids);
        }else{
            
            //if we want to exclude subtracks and that there is none, abord
            if (!$subtrack_ids){ 
                return $query;
            }
            
            $query->set('post__not_in',(array)$subtrack_ids);
        }

        return $query;
    }
    
    /*
    By default, Wordpress will sort the subtracks by date.
    If we have a subtracks query with a tracklist ID set; and that no orderby is defined, rather sort by tracklist position.
    */
    
    function sort_subtracks_by_position($orderby_sql, $query){
        $tracklist_id = $query->get('tracklist_id');
        $orderby = $query->get('orderby');
        $include_type = $query->get('subtracks_include');
        
        if ( !$include_type || !$tracklist_id || $orderby ) return $orderby_sql;

        $subtrack_ids = wpsstm_get_subtrack_ids($include_type,$tracklist_id);
        if (!$subtrack_ids) return $orderby_sql;
        
        $ordered_ids = implode(' ,',$subtrack_ids);
        
        return sprintf('FIELD(ID, %s)',$ordered_ids);

    }
    
}

function wpsstm_tracks() {
	return WP_SoundSystem_Core_Tracks::instance();
}

wpsstm_tracks();