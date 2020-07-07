jQuery(document).ready(function ($) {

    /**********************************
     ************* VARIABLES **********
     **********************************/
    let fieldSearchSchools = $('#schools_filter_text');
    let cityNameElements = $('.elementor-accordion .elementor-tab-title');
    let cityNameLinkElements = $('.elementor-accordion .elementor-tab-title a');
    let mapStaticImage = $('.find-ort');
    let btnEnableMap = $('.elementor-button');
    let mapElement = $('#map');
    let clsSearhedSchooMark = "searched-school-mark";
    let searhedSchoolMarkTagBegin = `<span class="${clsSearhedSchooMark}">`;
    let searhedSchoolMarkTagEnd = '</span>';
    let mediumSpeed = 2000;
    let map, geocoder, kmlLayer, infowindow, marker;
    let mapIsReset = true;
    let infoWindowWrapperClass = 'info_window_wrapper';
    let elementToWatchForAccessibility = "page";
    let centerLat = 32;
    let centerLong = 36.474776492187516;
    let zoomValue = 4; // With kmz layer zoom 8 is good. Without it, 4 is needed as 8 is too close

    /**********************************
     ************* EVENTS *************
     **********************************/

    /* When a user types, or focuses in the text input call the filterSchools function. */

    fieldSearchSchools.on('keyup', e => filterSchools(e));

    fieldSearchSchools.on('focus', e => schoolsFilterTextFocusHandler(e));

    cityNameElements.on('click', e => {
        if (mapStaticImage.is(":visible")) {
            mapStaticImage.hide(mediumSpeed);
            initMap();
        }
        cityClickedHandler($(e.target));
    });

    btnEnableMap.on('click', () => {
        mapStaticImage.hide(mediumSpeed);
        initMap();
    });

    window.addEventListener('scroll', windowScrollHandler);

    /* Watch accessibility css change of background color */
    bodyCssChange();

    /**
     * Needs to called before the map is created,
     * so any new cities are inserted into the json file and are shown in the list
     */
    updateCitiesFile();


    /**********************************
     ***** SEARCH SCHOOLS FILTER ******
     **********************************/

    /**
     * Show and hide cities and schools according to the value entered in the text input.
     */
    function filterSchools(event) {
        let citiesToShow = [];
        let elementorAccordionItems = $('.elementor-accordion-item');
        let searchValue = $(event.target).val();

        // First show all accordion items because some of them might have been hidden by previous search.
        elementorAccordionItems.show().each(function () {
            let currentCitySchools = $(this).find('.elementor-tab-content li');
            // now show all schools (because some of them might have been hidden by previous search)
            currentCitySchools.show();

            currentCitySchools.toArray().some(school => {
                let currSchool = $(school);

                currSchool.html(currSchool.html().replace(searhedSchoolMarkTagBegin, '').replace(searhedSchoolMarkTagEnd, ''));

                if (searchValue.length > 0 && currSchool.text().indexOf(searchValue) > -1) {
                    currSchool.html(currSchool.html().replace(searchValue, searhedSchoolMarkTagBegin + searchValue + searhedSchoolMarkTagEnd));
                    citiesToShow.push(currSchool.parents('.elementor-accordion-item'));
                }
            });

        });

        elementorAccordionItems.each(function () {
            let isItemInCitiesToShow = false;
            let doesItemCityHaveValue = false;
            let currCityName = $(this).find('.elementor-tab-title a').html();
            $(citiesToShow).each(function () {
                let currShownCityName = $(this).find('.elementor-tab-title a').html();
                if (currCityName === currShownCityName) {
                    isItemInCitiesToShow = true;
                    return true;
                }
            });

            // If the city does match the searched value, turn on the doesItemCityHaveValue flag to leave it showing.*/
            if (currCityName.indexOf(searchValue) > -1) {
                doesItemCityHaveValue = true;
            }
            /* Hide all accordion items whose cities don't contain the searched value and who don't have a school that contains that value*/
            if (!isItemInCitiesToShow && !doesItemCityHaveValue) {
                $(this).hide();
            }
        });
    }

    /**
     * What to do when user puts focus on the text input of the school filter:
     * 1. The map should go back to initial state
     * 2. The cities and schools should be filtered acoording to whatever input is in the text box
     * 3. Any markers showing on the map should be closed
     * @param event
     */
    function schoolsFilterTextFocusHandler(event) {
        // return map to original bounds and size
        resetMap();
        // filter the schools
        filterSchools(event);
        // close any open markers and infowindows
        closeClickHandler();
    }


    /***************************************
     * ********* Google Maps API ********* *
     ***************************************/

    /**
     * Initialize the map and all its objects - kmlLayer, infowindow
     */
    function initMap() {

        createMap();

        addKmlLayer();

        createInfoWindowObject();

        /***********/
        /* EVENTS */
        /***********/

        /* When the map bounds are changed, change the city list to reflect the new bounds */
        google.maps.event.addListener(map, 'bounds_changed', boundsChangedHandler);

        /* When one of the markers is clicked, open a styled popup, using the InfoWindow object created earlier */
        kmlLayer.addListener('click', kmlLayerClickedHandler);

        /* event taken from here: https://stackoverflow.com/questions/6777721/google-maps-api-v3-infowindow-close-event-callback/6777885#6777885 */
        google.maps.event.addListener(infowindow, 'closeclick', closeClickHandler);

        /* Clicking the map closes anything that had to do with clicking a marker */
        google.maps.event.addListener(map, 'click', mapClickHandler);

    }

    /**
     * Create map and center it in the center of Israel
     */
    function createMap() {
        let mapOptions = {
            center: new google.maps.LatLng(centerLat, centerLong),
            zoom: zoomValue
        };
        map = new google.maps.Map(document.getElementById('map'), mapOptions);
    }

    /**
     * Synchronize with an externally created mao by using the KmlLayer object.
     * We export a kmz file from the external map and upload it to our site uploads folder.
     * We add the Date parameter to get the updated version once a day. We don't do it more frequently because it hurts performance
     */
    function addKmlLayer() {
        let today = new Date();
        kmlLayer = new google.maps.KmlLayer({
            url: `${schools_and_map_filter_ajax_obj.kmz_file}?ver=${today.getDate()}`
        });
		console.log(kmlLayer);
        resetMap();
    }

    /**
     * Reset the map to the kmlLayer
     */
    function resetMap() {
        if (typeof kmlLayer !== 'undefined') {
            // Set the map without using the kmlLayer, because when kmlLayer doesn't exist, the map setting doesn't work
            map.setCenter(new google.maps.LatLng(centerLat, centerLong));
            map.setZoom(zoomValue);
            mapIsReset = true;
        }
    }

    /**
     * The window which pops up on clicking a marker has to be styled,
     * and instead of trying to style the actual popup, we create our own.
     */
    function createInfoWindowObject() {
        infowindow = new google.maps.InfoWindow({
            /* The pixelOffset tells the infoWindow to move 35 pixels above its position.
            * This is so the user can still see the marker that was clicked.
            * Taken from:
            * https://stackoverflow.com/questions/31064916/how-to-change-position-of-google-maps-infowindow/31068910#31068910
            * */
            pixelOffset: new google.maps.Size(0, -35)
        });
    }

    /**
     * When the map's bounds change (by zoom or by dragging the map),
     * filter the city list to only the cities that appear in the map
     * This is fired right on the map load because of the kmlLayer added.
     */
    function boundsChangedHandler() {
        /* Sometimes the kml layer comes late and the bounds change while the user is filtering.
        * Since the bounds chage affect the city list and so does the filtering, we should make sure
        * the application of the changed bounds shouldn't happen if the user is in the middle of filtering. */
        if (!fieldSearchSchools.is(':focus')) {
            // get new bounds
            let mapBounds = map.getBounds();
            if (mapBounds !== null) {
                $.getJSON(`${schools_and_map_filter_ajax_obj.json_file}?ver=${Date.now()}`, (data) => {
                    let res = getCitiesinMap(data, mapBounds);

                    // filter out cities that don't appear in bounds
                    cityNameLinkElements.each((key, value) => {
                        let elementorAccordionItem = $(value).parents('.elementor-accordion-item');
                        // if the innerHTML, which is the city name, doesn't exist in the list of filtered cities, hide it
                        let cityExists = res.filter(item => item.name.trim() === value.innerHTML.trim());
                        // if the city doesn't appear in bounds, hide it
                        if (cityExists.length === 0) {
                            // hide it
                            elementorAccordionItem.hide();
                        }
                        // if the city appears - make it show (needed on zoom out, to return the cities previously hidden)
                        else {
                            /* The value is the cityNameLinkElement
                            * if the city exists, turn on its parent and its siblings which are the schools */
                            elementorAccordionItem.show();
                            elementorAccordionItem.find('.elementor-tab-content a').show();
                        }
                    });
                });
            }
            mapIsReset = false;
        }
    }

    /**
     * Get an array of cities that appear in the map after its bounds have changed
     * @param cityFilecontents - the cities that we stored in our json file, including their geocode data
     * @param mapBounds - the bounds of the map after change
     * @returns the city that appears in the map, or nothing of city doesn't appear in the map
     */
    function getCitiesinMap(cityFilecontents, mapBounds) {
        return cityFilecontents.filter(city => {
            // first check if the map contains this city's location
            let mapContainsCity = mapBounds.contains(city.location);
            /* if not, it could be because of very large zoom, that excludes this city's bounds.
             * In this case we want to check if the center of the map is in this city's bounds */
            if (!mapContainsCity) {
                // create a bounds object out of this city's bounds
                let cityBounds = new google.maps.LatLngBounds(
                    city.southWestViewport,
                    city.northEastViewport
                );
                // check if the city bounds contain this map's center
                mapContainsCity = cityBounds.contains(map.getCenter());
            }
            if (mapContainsCity) {
                return city;
            }
        });
    }


    /**
     * Run when the infowindow is closed. It changes the marker back to the original one
     */
    function closeClickHandler() {
        closeInfoWindow();
        removeProviouslySelectedMarker();
    }

    /**
     * Clicking the map closes anything that had to do with clicking a marker, namely:
     * 1. The info window
     * 2. The selected marker
     */
    function mapClickHandler() {
        closeClickHandler();
    }

    /**
     * Remove the marker that was created a marker was clicked, back to the original marker
     */
    function closeInfoWindow() {
        if (infowindow != null) {
            infowindow.close();
        }
    }

    /**
     * delete the marker that was created for the previously clicked marker
     */
    function removeProviouslySelectedMarker() {
        if (marker != null) {
            marker.setMap(null);
        }
    }


    /**
     * This function is run when a city is clicked and it syncs city click with map, i.e the map zooms in on that city.
     * It looks up the city in our JSON file (cities_map.json, in the JS folder of this plugin),
     * returns its coordinates, and those coordinates are assigned to the center of the map.
     */
    function cityClickedHandler(self) {

        let accordionItem = self.parents('.elementor-accordion-item');

        /* If city is open but doesn't have a cityOpen class,
        identify it by the elementor-active class that its elementor-tab-content has.
         This happens when one of cities is displayed open by default when the accordion loads */
        if (accordionItem.children('.elementor-active').length > 0) {
            accordionItem.addClass('cityOpen');
        }

        if (accordionItem.siblings().hasClass('cityOpen')) {
            accordionItem.siblings().removeClass('cityOpen');
        }
        // toggle class so we know if we're opening or closing a city
        accordionItem.toggleClass('cityOpen');
        /* If the click was to open city, change the map bounds.
         * Else the click is closing the city, and the bpunds should return to original */
        if (accordionItem.hasClass('cityOpen')) {
            /* if we clicked after search, some of the schools might be hidden.
            * If the map is reset that means we're in filter mode, and we want to show only the filtered schools.
            * But if the map is focused then we're in regular mode and we want to show all schools */
            if (!mapIsReset) {
                accordionItem.find('li').show();
            }
            // this is the link that was clicked, and its inner HTML contains the city name
            let address = accordionItem.find('.elementor-tab-title a').html();
            // read fron the JSON file. Added the Date.now() to the version, so the file is always fresh during development.
            // TODO: remove version when upload to production
            $.getJSON(`${schools_and_map_filter_ajax_obj.json_file}?ver=${Date.now()}`, (data) => {
                // check if the current clicked city is in the file
                let res = data.filter(item => item.name === address);
                // if it's in the file, sync the map to zoom in on that city
                if (res.length > 0) {
                    applyCityClickToMap(res[0]);
                }
            });
        } else {
            // when the city is clicked closed, resume the original bounds and zoom
            resetMap();
        }
    }

    /**
     * Change the zoom and bounds of the map according to the location of the city that was clicked.
     * The method attempts to first use the southWestViewport and northEastViewport properties because they are the most accurate.
     * If they don't exist, it uses the bounds property.
     * If the doesn't exist, it uses the location and zoom properties which are the least accurate measures.
     * @param result - the result object. It has the location, zoom, bounds, southWestViewport, and northEastViewport properties.
     */
    function applyCityClickToMap(result) {
        /*  code taken from: https://stackoverflow.com/questions/9491114/google-maps-api-v3-geocoder-results-issue-with-bounds */
        if (result.southWestViewport && result.northEastViewport) {
            var resultBounds = new google.maps.LatLngBounds(
                result.southWestViewport,
                result.northEastViewport
            );
            map.fitBounds(resultBounds);
        } else {
            if (result.bounds) {
                map.fitBounds(result.bounds);
            } else {
                map.setCenter(result.location);
                map.setZoom(result.zoom);
            }
        }
    }

    /**
     * If the city doesn't exist in the JSON file, we use the geocoder to get its ccordinates info from google, and insert it into the JSON file
     */
    function updateCitiesFile() {
        if (schools_and_map_filter_ajax_obj.is_user_admin) {
            $.getJSON(`${schools_and_map_filter_ajax_obj.json_file}?ver=${Date.now()}`, (data) => {
                // filter out cities that don't appear in bounds
                cityNameLinkElements.each((key, cityElement) => {
                    // if the innerHTML, which is the city name, doesn't exist in the list of filtered cities, hide it
                    let cityExists = data.filter(item => item.name.trim() === cityElement.innerHTML.trim());
                    // if the city doesn't appear in bounds, hide it
                    if (cityExists.length === 0) {
                        // then check if it has a geocode and simply didn't appear in the file
                        let address = cityElement.innerHTML; // get the name of the current city
                        /**** prepare the geocode request and send it to the geocode function ****/
                        var geocodeRequest = {
                            address: address
                        };
                        geocoder = new google.maps.Geocoder();
                        geocoder.geocode(geocodeRequest, (results, status) => {
                            if (status === google.maps.GeocoderStatus.OK) {
                                if (results.length > 0) {
                                    /* Insert the result from the geocode function into the file*/
                                    result = results[0];
                                    data = insertCityIntoJson(data, address, result);
                                    /* must update the file in this loop because it's async, and outside it we don't know if it has finished */
                                    /* if there is a new city, update the json file */
                                    updateJsonFile(data);
                                }
                            } else {
                                console.log('Could not gecode: ' + status);
                            }
                        });
                    } // END if (cityExists.length === 0)
                }); // END cityNameLinkElementsiteration
            }); // END json file iteration
        }
    }

    /**
     * Adds the new city to the city array and sends it to the backend via AJAX.
     * The backend inserts it into the json file
     * @param cities
     * @param newCityName
     * @param geocodeResult
     * @returns array - the cities array with the new city
     */
    function insertCityIntoJson(cities, newCityName, geocodeResult) {
        let newCity = {
            "name": newCityName,
            "location": geocodeResult.geometry.location,
            "zoom": 8,
            "bounds": geocodeResult.geometry.bounds,
            "southWestViewport": result.geometry.viewport.getSouthWest(),
            "northEastViewport": result.geometry.viewport.getNorthEast()
        };
        cities.push(newCity);
        return cities;
    }

    /**
     *
     * @param cities
     */
    function updateJsonFile(cities) {
        let newData = JSON.stringify(cities);
        $.post(
            schools_and_map_filter_ajax_obj.ajax_url,
            {
                //POST request
                _ajax_nonce: schools_and_map_filter_ajax_obj.nonce,
                action: "schools_map_locations_update",
                newData: newData // cities
            },
            function (data) {
                //nothing to do with data
            });
    }

    /**
     * This is the function that creates our own info window
     * @param event - has the featureData and latLng fields that are needed to create our window.
     */
    function openInfoWindow(event) {
        if (event.featureData.status === "OK") {
            let infoWindowWrapperBegin = "<div class='" + infoWindowWrapperClass + "'" + updateInfowWindowForA11y() + ">";
            let infoWindowWrapperEnd = "</div>";
            let infowindowTitle = "<h3 class='info_window_header'>" + event.featureData.name + "</h3>";
            let infowindowDescription = "<div class='info_window_content'>";
            infowindowDescription += getInfowindowFeaturedData(event.featureData.description);
            infowindowDescription += "</div>"; // + event.featureData.description +
            infowindow.setContent(infoWindowWrapperBegin + infowindowTitle + infowindowDescription + infoWindowWrapperEnd);
            infowindow.setPosition(event.latLng); // even though we set the pixelOffset in the constructor, we also have to set the position.
            /* this is the only way I found to hide the original infowindow because suppressInfoWindows doesn't work and neither does showInfoWindowOnClick.
            Got the idea from here: https://stackoverflow.com/a/22083454/278
            maybe try baloonstyle: https://stackoverflow.com/questions/32557103/kml-file-is-there-a-way-to-completely-disable-description-bubbles*/
            event.featureData.infoWindowHtml = "";
            infowindow.open(map);
        }
    }


    /**
     * Extract from the array of info the address of the school,
     * by searching for the part that has the string כתובת: or אתר בית ספר or any other string that might indicate our desired info
     * @param descriptionParts - the array of info from the info window
     * @param searchString - the string that might indicate our desired info
     * @param label - the label of the current field. We want to get rid of it
     * @returns {string} - the school addresses, without any other words
     */
    function getInfoFromInfowindow(descriptionParts, searchString, label) {
        let ret = "";
        let infoArr = descriptionParts.filter(item => item.indexOf(searchString) > -1);
        if (infoArr.length > 0) {
            for (var infoData of infoArr) {
                let info = decodeURI(encodeURI(infoData)
                    .replace(/%E2%80%8E/g, "")) // some strings come with these characters attached and some dont, and it affects the results of indexOf
                    .replace(label, "")
                    .replace(schools_and_map_filter_ajax_obj.strMarkerDescription, "")
                    .replace(/target="_blank"/g, "")
                    .trim();
                if (ret.indexOf(info) === -1) {
                    if (ret !== "") {
                        ret += ", ";
                    }
                    ret += info;
                }
            }
        }
        return ret;
    }

    /**
     * Get the description from the Google window and parse them to display in our window
     * @param description - has the address and the site url of this school
     * @returns string - the HTML of the parsed description
     */
    function getInfowindowFeaturedData(description) {
        let ret = "", schoolAddress, schoolUrl;
        let descriptionParts = description.split('<br>');
        if (descriptionParts.length > 0) {
            schoolAddress = getInfoFromInfowindow(descriptionParts, schools_and_map_filter_ajax_obj.strSchoolAddress, schools_and_map_filter_ajax_obj.strSchoolAddress);
            schoolUrl = getInfoFromInfowindow(descriptionParts, '<a', schools_and_map_filter_ajax_obj.strSchoolUrl);

            ret += wrapInHTML(schools_and_map_filter_ajax_obj.strSchoolAddress, schoolAddress);
            if (schoolUrl !== "") {
                schoolUrl = removeTrailingSlashFromURL(schoolUrl);
                ret += wrapInHTML(schools_and_map_filter_ajax_obj.strSchoolUrl, schoolUrl);
            }

        }
        return ret;
    }

    /**
     * Removes the trailing slash from the school URL
     * @param schoolUrl - the school URL
     * @returns the schoolUrl without trailing slash
     */
    function removeTrailingSlashFromURL(schoolUrl) {
        return schoolUrl
            .replace(/\/<\/a>/g, "</a>")
            .replace(/<a /g, "<a class='info_window_school_link'");
    }


    /**
     * Wrap the string with a div, and add the title wrapped in a span with class.
     * @returns {string} - str + title in HTML tags
     */
    function wrapInHTML(title, str) {
        str = "<div>" + "<span class='info_window_term'>" + title + "</span> " + str + "</div>";
        return str;
    }


    /**
     * https://stackoverflow.com/questions/41480242/how-to-change-the-icon-on-google-map-while-the-layer-is-import-by-kml-file
     * @param event
     */
    function changeMarkerIcon(event) {
        var eLatLng = event.latLng;

        //this will remove the previous marker
        removeProviouslySelectedMarker();

        // create new marker with the location of the marker that was clicked
        marker = new google.maps.Marker({
            position: eLatLng,
            map: map,

        });

        // give it its special icon
        marker.setIcon('https://mapa-linux-test.ort.org.il/ort-site-2019/wp-content/plugins/schools-and-map/img/selected_marker.png');
    }

    function updateInfowWindowForA11y() {
        let pageStyle = $('#' + elementToWatchForAccessibility).attr('style');
        if (pageStyle !== "") {
            return "style='" + pageStyle + "'";
        }
    }

    /**
     * taken from here:
     * https://stackoverflow.com/questions/37236774/how-to-control-the-content-of-a-google-maps-info-window-on-a-kmllayer/37240595#37240595
     * This also has handy info: https://codepen.io/Marnoto/pen/xboPmG
     * @param event
     */
    function kmlLayerClickedHandler(event) {
        openInfoWindow(event);
        changeMarkerIcon(event);
    }


    /***************************************
     * ********** Button to Map ********** *
     ***************************************/

    /**
     * There is a button to jump from the city list to the map, and a button to jump back.
     * They  interchange on scroll:
     * When the list is in view show the button to the map,
     * and when the map is in view show the button to the list
     */
    function windowScrollHandler() {
        let linkToMap = $('.link_to_map');
        let linkToList = $('.link_to_list');
        if (linkToMap.is(':visible') || linkToList.is(':visible')) {
            if (isElementInViewport(mapElement)) {
                // when map is in view, hide the map button
                linkToMap.hide();
                linkToList.show();
            } else {
                linkToMap.show();
                linkToList.hide();
            }
        }
    }

    /**
     * Check if parameter is in viewport by comparing its borders and comparing it with the window's height
     * https://stackoverflow.com/questions/123999/how-to-tell-if-a-dom-element-is-visible-in-the-current-viewport/7557433#7557433
     * @param el
     * @returns true if element is in viewport, and false if not.
     */
    function isElementInViewport(el) {

        //Use jQuery
        if (typeof $ === "function" && el instanceof $) {
            el = el[0];
        }

        /* The Element.getBoundingClientRect() method returns the size of an element and its position relative to the viewport. */
        var rect = el.getBoundingClientRect();

        return (
            rect.top >= 0 &&
            rect.top <= $(window).height()
            ||
            rect.bottom >= 0 &&
            rect.bottom <= $(window).height()
        );
    }

    /***************************************
     * ******* A11y Functionality ******** *
     ***************************************/

    /**
     * When background color changes, keep the map's background transparent
     * taken from here:
     * https://stackoverflow.com/a/20683311/278
     */
    function bodyCssChange() {
        // Select the node that will be observed for mutations
        var targetNode = document.getElementById(elementToWatchForAccessibility);
        // Options for the observer (which mutations to observe)
        var config = {
            attributes: true,
            attributeFilter: ['style'],
            characterData: true,
            childList: false,
            subtree: false,
            attributeOldValue: true,
            characterDataOldValue: true
        };

        // In this callback function we traverse the map's child nodes and assign them a transparent background
        var callback = function (mutationsList) {
            for (var mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    mapElement.css({
                        'background-color': 'transparent'
                    });

                    let currElements = mapElement.children();

                    while (currElements.length > 0) {

                        if (shouldStyleChange(currElements)) {
                            currElements.css({
                                'background-color': 'transparent'
                            });
                        }
                        currElements = currElements.children();
                    }
                }
            }
        };

        // Create an observer instance linked to the callback function
        var observer = new MutationObserver(callback);

        // Start observing the target node for configured mutations
        observer.observe(targetNode, config);

    }

    /**
     * Return if current element should change style.
     * Needed to keep the accessibility style for the infoWindow
     */
    function shouldStyleChange(currElements) {
        let shouldChangeStyle = true;
        currElements.each(function () {
            if ($(this).get(0) === $('.' + infoWindowWrapperClass).get(0)) {
                shouldChangeStyle = false;
            }
        });
        return shouldChangeStyle;
    }
});