<?php
/*
  Plugin Name: Schools and Maps
  Plugin URI: http://ort.org.il
  Description: This plugin anables the shools filter, and the school list sync with map
  Version: 0.1
  Author: ORT Israel R&D team
  Author URI:
  License:
  License URI:
 */

class SchoolsAndMaps {
	public function init() {
		add_action( 'init', [ $this, 'load_textdomain' ] );
		add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_scripts' ] );
		/* Schools page actions and shortcode - Begin */
		add_shortcode( 'schools_filter', [ $this, 'schools_filter_shortcode' ] );
		add_action( 'schools_map_locations_update', [ $this, 'schools_map_locations_update' ] );
		add_action( 'wp_ajax_schools_map_locations_update', [ $this, 'schools_map_locations_update' ] );
		add_action( 'wp_ajax_nopriv_schools_map_locations_update', [ $this, 'schools_map_locations_update' ] );
		/* Schools page actions and shortcode - End */
	}

	/**
	 * Load plugin textdomain.
	 */
	public function load_textdomain() {
		load_plugin_textdomain( 'schools-and-maps', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
	}

	/**
	 * Enqueu the scripts and stylesheet needed for this plugin
	 */
	public function enqueue_scripts() {
		// enqueue the maps api script on its specific page:
		if ( is_page( '28963' ) ) {
			$GOOGLE_MAPS_API = WP_GOOGLE_MAPS_API;
			global $is_IE;
			if ( $is_IE ) {
				wp_enqueue_script( 'schools_and_map_filter', plugin_dir_url( __FILE__ ) . 'js/schools_filter_ie.js', array( 'jquery' ), time(), true );
			} else {
				wp_enqueue_script( 'schools_and_map_filter', plugin_dir_url( __FILE__ ) . 'js/schools_filter.js', array( 'jquery' ), time(), true );
			}
			wp_enqueue_script( 'google-maps-script', "https://maps.googleapis.com/maps/api/js?key={$GOOGLE_MAPS_API}&language=he&region=IL", array( 'schools_and_map_filter' ), '1.0.1.2', true );
			//wp_enqueue_style( 'schools_and_map_style', plugin_dir_url( __FILE__ ) . 'css/style.css', array(), time() );

			// the page needs ajax in order to write to the citites json file
			$title_nonce = wp_create_nonce( 'title_example' );
			wp_localize_script( 'schools_and_map_filter', 'schools_and_map_filter_ajax_obj', array(
				'json_file' => plugin_dir_url( __FILE__ ) . 'js/cities_map.json',
				'ajax_url'  => admin_url( 'admin-ajax.php' ),
				'nonce'     => $title_nonce, // It is common practice to comma after
				'xmz_file'  => site_url( 'wp-content/uploads/2019/03/ort-schools2019.kmz' ),
			) );
		}
	}

	/**
	 * This function creates the filtering form.
	 * The JS that runs it is called in the enqueue_scripts function
	 */
	public function schools_filter_shortcode() {

		$str = ' <div class="schools_filter_wrapper">
            <form class="schools_filter_form">
                <label for="schools_filter_text">' . __( 'Where would you like to learn?', 'schools-and-maps' ) . '</label>
                <input type="text" id="schools_filter_text" class="schools_filter_text"
                       placeholder="' . __( 'City or school that interest you', 'schools-and-maps' ) . '">
            </form>
        </div>';

		return $str;
	}


	/**
	 * This function is called via ajax, and updates the JSON file
	 */
	public function schools_map_locations_update() {
		check_ajax_referer( 'title_example' );
		// Handle the ajax request
		$updatedData = $_POST['newData'];

		$success = file_put_contents( plugin_dir_path( __FILE__ ) . 'js/cities_map.json',
			//  validate and sanitize the data for security
			filter_var( strip_tags( stripslashes( $updatedData ) ) ), FILTER_SANITIZE_STRING );
		wp_die(); // All ajax handlers die when finished
	}
}

$schoolsAndMaps = new SchoolsAndMaps();
$schoolsAndMaps->init();