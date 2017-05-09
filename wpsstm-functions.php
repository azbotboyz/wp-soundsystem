<?php

/**
 * Get a value in a multidimensional array
 * http://stackoverflow.com/questions/1677099/how-to-use-a-string-as-an-array-index-path-to-retrieve-a-value
 * @param type $keys
 * @param type $array
 * @return type
 */
function wpsstm_get_array_value($keys = null, $array){
    if (!$keys) return $array;
    
    $keys = (array)$keys;
    $first_key = $keys[0];
    if(count($keys) > 1) {
        if ( isset($array[$keys[0]]) ){
            return wpsstm_get_array_value(array_slice($keys, 1), $array[$keys[0]]);
        }
    }elseif (isset($array[$first_key])){
        return $array[$first_key];
    }
    
    return false;
}

/*
Get the IDs of every tracks appearing in a tracklist (playlist or album)
*/

function wpsstm_get_all_subtrack_ids($db_check=true,$args=null){
    global $wpdb;
    $query = $wpdb->prepare( "SELECT meta_value FROM $wpdb->postmeta WHERE `meta_key` = '%s'", 'wpsstm_subtrack_ids' );
    $metas = $wpdb->get_col( $query );
    
    $subtrack_ids = array();

    foreach($metas as $meta){
        $ids = maybe_unserialize($meta);
        $subtrack_ids = array_merge($subtrack_ids,$ids);
    }
    
    $subtrack_ids = array_unique($subtrack_ids);
    
    if ($db_check){
        $default_args = array(
            'post_type'         => wpsstm()->post_type_track,
            'post_status'       => 'any',
            'posts_per_page'    => -1,
            'fields'            => 'ids',
            'post__in'          => $subtrack_ids
        );

        if ($args){
            $args = wp_parse_args($args,$default_args);
        }

        $query = new WP_Query( $args );
        if ( $db_ids = $query->posts ){
            $subtrack_ids = array_intersect($subtrack_ids, $db_ids);
        }
        
    }
    
    return $subtrack_ids;
    
}

/*
Get IDs of the parent tracklists (albums / playlists) for a subtrack.
*/

function wpsstm_get_subtrack_parent_ids($post_id, $args = null){
    global $wpdb;

    $meta_query = array();
    $meta_query[] = array(
        'key'     => 'wpsstm_subtrack_ids',
        'value'   => serialize( $post_id ), //https://wordpress.stackexchange.com/a/224987/70449
        'compare' => 'LIKE'
    );
    
    $default_args = array(
        'post_type'         => array(wpsstm()->post_type_album,wpsstm()->post_type_playlist,wpsstm()->post_type_live_playlist),
        'post_status'       => 'any',
        'posts_per_page'    => -1,
        'fields'            => 'ids',
        'meta_query'        => $meta_query
    );
    
    if ($args){
        $args = wp_parse_args($args,$default_args);
    }

    $query = new WP_Query( $args );
    $ids = $query->posts;
    return $ids;
}
/**
* Make a nested HTML list from a multi-dimensionnal array.
*/

function wpsstm_get_list_from_array($input,$parent_slugs=array() ){
    
    $output = null;
    $output_classes = array("pure-tree");
    if ( empty($parent_slugs) ){
        $output_classes[] =  'main-tree';
    }
    
    
   foreach($input as $key=>$value){
        
       //if (!$value) continue; //ignore empty values
       
        $data_attr = $label = null;
        $checkbox_classes = array("checkbox-tree-checkbox");
        $item_classes = array("checkbox-tree-item");
       
        if( is_array($value) ){
            $parent_slugs[] = $key;
            $li_value = wpsstm_get_list_from_array($value,$parent_slugs);

            $item_classes[] = 'checkbox-tree-parent';
        }else{
            $li_value = $value;
        }
       
       if (!$li_value) continue;
       

       
        //$u_key = md5(uniqid(rand(), true));
        $u_key = implode('-',$parent_slugs);
        $data_attr = sprintf(' data-array-key="%s"',$key);

        $checkbox_classes_str = wpsstm_get_classes_attr($checkbox_classes);
        $item_classes_str = wpsstm_get_classes_attr($item_classes);
        $checkbox = sprintf('<input type="checkbox" %1$s id="%2$s"><label for="%2$s" class="checkbox-tree-icon">%3$s</label>',$checkbox_classes_str,$u_key,$key);

        $output.= sprintf('<li%1$s%2$s>%3$s%4$s</li>',$item_classes_str,$data_attr,$checkbox,$li_value);
    }
    
    if ($output){
        $output_classes_str = wpsstm_get_classes_attr($output_classes);
        return sprintf('<ul %s>%s</ul>',$output_classes_str,$output);
    }
    

}

function wpsstm_get_transients_by_prefix( $prefix ) {
	global $wpdb;
    
    $names = array();
    
	// Add our prefix after concating our prefix with the _transient prefix
	$name = sprintf('_transient_%s_',$prefix);
	// Build up our SQL query
	$sql = "SELECT `option_name` FROM $wpdb->options WHERE `option_name` LIKE '%s'";
	// Execute our query
	$transients = $wpdb->get_col( $wpdb->prepare( $sql, $name . '%' ) );

	// If if looks good, pass it back
	if ( $transients && ! is_wp_error( $transients ) ) {
        
        foreach((array)$transients as $real_key){
            $names[] = str_replace( '_transient_', '', $real_key );
        }
        
		return $names;
	}
	// Otherise return false
	return false;
}

/**
 * Outputs the html readonly attribute.  Inspired by core function disabled().
 *
 * Compares the first two arguments and if identical marks as readonly
 *
 * @since 3.0.0
 *
 * @param mixed $readonly One of the values to compare
 * @param mixed $current  (true) The other value to compare if not just true
 * @param bool  $echo     Whether to echo or just return the string
 * @return string html attribute or empty string
 */
function wpsstm_readonly( $readonly, $current = true, $echo = true ) {
	return __checked_selected_helper( $readonly, $current, $echo, 'readonly' );
}


/**
 * Locate template.
 *
 * Locate the called template.
 * Search Order:
 * 1. /themes/CURRENT_THEME/wpsstm/$template_name
 * 2. /themes/CURRENT_THEME/$template_name
 * 3. /plugins/wpsstm/_inc/templates/$template_name.
 *
 * @since 1.0.0
 *
 * @param 	string 	$template_name			Template to load.
 * @param 	string 	$string $template_path	Path to templates.
 * @param 	string	$default_path			Default path to template files.
 * @return 	string 							Path to the template file.
 */
function wpsstm_locate_template( $template_name, $template_path = '', $default_path = '' ) {
	// Set variable to search in wpsstm folder of theme.
	if ( ! $template_path ) :
		$template_path = 'wpsstm/';
	endif;
	// Set default plugin templates path.
	if ( ! $default_path ) :
		$default_path = wpsstm()->plugin_dir . 'templates/'; // Path to the template folder
	endif;
	// Search template file in theme folder.
	$template = locate_template( array(
		$template_path . $template_name,
		$template_name
	) );
	// Get plugins template file.
	if ( ! $template ) :
		$template = $default_path . $template_name;
	endif;
	return apply_filters( 'wpsstm_locate_template', $template, $template_name, $template_path, $default_path );
}

/**
Returns the class instance for a wp music post id
Requires a post_id, global $post is not always available here
**/
function wpsstm_get_class_instance($post_id){
    $post_type = get_post_type($post_id);

    switch($post_type){

        case wpsstm()->post_type_artist:
            return wpsstm_artists();
        break;

        case wpsstm()->post_type_track:
            return wpsstm_tracks();
        break;

        case wpsstm()->post_type_album:
            return wpsstm_albums();
        break;

        case wpsstm()->post_type_playlist:
            return wpsstm_playlists();
        break;

        case wpsstm()->post_type_live_playlist:
            return wpsstm_live_playlists();
        break;

    }
}

function wpsstm_get_soundsgood_sources($track,$platform,$args=null){

        $args_default = array(
            'cache_only'    => false,
            'max'           => 5,
            'single_source' => true //skip after one source found
        );

        $args = wp_parse_args((array)$args,$args_default);

        $sources = $remote = $cache = null;
        $transient_name = 'wpsstm_provider_source_' . $track->get_unique_id($platform); //TO FIX could be too long ?
        $cache = $sources = get_transient( $transient_name );

        if ( !$args['cache_only'] && ( false === $cache ) ) {

            $sources = array();

            $api_url = 'https://heartbeat.soundsgood.co/v1.0/search/sources';
            $api_args = array(
                'apiKey'                    => '0ecf356d31616a345686b9a42de8314891b87782031a2db5',
                'limit'                     => $args['max'],
                'platforms'                 => $platform,
                'q'                         => urlencode($track->artist . ' ' . $track->title),
                'skipSavingInDatabase'      => true
            );
            $api_url = add_query_arg($api_args,$api_url);
            $response = wp_remote_get($api_url);
            $body = wp_remote_retrieve_body($response);

            if ( is_wp_error($body) ) return $body;
            $api_response = json_decode( $body, true );

            $items = wpsstm_get_array_value(array(0,'items'),$api_response);

            foreach( (array)$items as $item ){
                $source = array(
                    'title'     => wpsstm_get_array_value('initTitle',$item),
                    'url'       => wpsstm_get_array_value('permalink',$item)
                );
                $sources[] = $source;
            }

            $remote = $sources = wpsstm_sources()->sanitize_sources($sources);
            set_transient($transient_name,$sources, wpsstm()->get_options('autosource_cache') );
            
            wpsstm()->debug_log(json_encode(array('track'=>$track,'platform'=>$platform,'args'=>$args,'cache'=>$sources,'remote'=>$remote)),'wpsstm_get_soundsgood_sources()' ); 
            
        }

        return $sources;
    }