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

    /**********************************
     ************* EVENTS *************
     **********************************/

    /* When a user types, or focuses in the text input call the filterSchools function. */

    fieldSearchSchools.on('keyup', e => filterSchools($(e.target)));

    fieldSearchSchools.on('focus', e => schoolsFilterTextFocusHandler($(e.target)));

    cityNameElements.on('click', e => {
            if (mapStaticImage.is(":visible")) {
                mapStaticImage.hide(2000);
                initMap();
            }
            cityClickedHandler($(e.target));
        }
    );

    btnEnableMap.on('click', () => {
        mapStaticImage.hide(2000);
        initMap();
    });

    window.addEventListener('scroll', windowScrollHandler);

    /**********************************
     ***** SEARCH SCHOOLS FILTER ******
     **********************************/

    /**
     * Show and hide cities and schools according to the value entered in the text input.
     * The logic of looking up the text from the search in the city names using a Regular Expression is taken from:
     * https://stackoverflow.com/questions/27096548/filter-by-search-using-text-found-in-element-within-each-div/27096842#27096842
     */
    function filterSchools(searchField) {
        /* Start with SCHOOL names - find('.elementor-tab-content a') -
        * find the schools that match the searched value.
        * Start with showing all, for cases when the search changed completely */
        let shownCitiesBecauseOfSchools = [];
        let elementorAccordionItems = $('.elementor-accordion-item');

        // first show all accordion items, because some of them might have been hidden by previous search. then iterate over them
        elementorAccordionItems.show().each(function () {
                let currentCitySchools = $(this).find('.elementor-tab-content li');
                // now show all schools (because some of them might have been hidden by previous search)
                currentCitySchools.show();

                currentCitySchools.toArray().some(school => {

                    $(school).text(removeMarkTheSearchedValue($(school).text()));
                    /* Then look for the searched value. If it exists, do 2 things:
                    * 1. Mark the search string in the school name
                    * 2. add the accordion item to the array of items that should be shown */
                    if ($(school).text().indexOf(searchField.val()) > -1) {
                        $(school).html(markTheSearchedValue($(school).text(), $(school).text().indexOf(searchField.val()), searchField.val().length));
                        shownCitiesBecauseOfSchools.push($(school).parents('.elementor-accordion-item'));
                    }
                });

            }
        );

        /* Then Check the city name:
        * If it's in the shownCitiesBecauseOfSchools, turn on the isItemInShownCities and leave the loop */
        elementorAccordionItems.each(function () {
            let isItemInShownCities = false;
            let doesItemCityHaveValue = false;
            let currCityName = $(this).find('.elementor-tab-title a').text();
            $(shownCitiesBecauseOfSchools).each(function () {
                let currShownCityName = $(this).find('.elementor-tab-title a').text();
                if (currCityName === currShownCityName) {
                    isItemInShownCities = true;
                    return true;
                }
            });

            // If the city does match the searched value, turn on the doesItemCityHaveValue flag to leave it showing.*/
            if (currCityName.indexOf(searchField.val()) > -1) {
                doesItemCityHaveValue = true;
            }
            /* Hide all accordion items whose cities  don't contain the searched value and who don't have a school that contains that value*/
            if (!isItemInShownCities && !doesItemCityHaveValue) {
                $(this).hide();
            }
        });
    }

    /**
     * Make the searched value stand out in the schoo name
     * @param stringToMark
     * @param startMark
     * @param markLength
     * @returns {string}
     */
    function markTheSearchedValue(stringToMark, startMark, markLength) {
        return stringToMark.slice(0, startMark)
            + '<span class="searched-school-mark">'
            + stringToMark.slice(startMark, startMark + markLength)
            + '</span>'
            + stringToMark.slice(startMark + markLength);
    }

    /**
     * Remove the searched value mark every time a new search is run, otherwise the mark interferes with the search
     * @param stringToRemoveMark
     * @returns {string}
     */
    function removeMarkTheSearchedValue(stringToRemoveMark) {
        return stringToRemoveMark.replace('<span class="mark">', '').replace('</span>', '');
    }

    /**
     * What to do when user puts focus on the text input of the school filter:
     * 1. The map should go back to initial state
     * 2. The cities and schools should be filtered acoording to whatever input is in the text box
     * 3. Any markers showing on the map should be closed
     * @param self - $('#schools_filter_text')
     */
    function schoolsFilterTextFocusHandler(self) {
        // return map to original bounds and size
        resetMap();
        // filter the schools
        filterSchools(self);
        // close any open markers and infowindows
        closeClickHandler();
    }


    /***************************************
     * ********* Google Maps API ********* *
     ***************************************/

    let map, geocoder, kmlLayer, infowindow, marker;
    let mapIsReset = true;

    /**
     * Needs to called before the map is created,
     * so any new cities are inserted into the json file and are shown in the list
     */
    updateCitiesFile();

    /* Call initMap to initialize the map */

    //initMap();

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
    function createMap(lat = 32.61074307932485, long = 36.474776492187516) {
        let mapOptions = {
            center: new google.maps.LatLng(lat, long),
        };
        map = new google.maps.Map(document.getElementById('map'), mapOptions);
    }

    /**
     * Synchronize with an externally created mao by using the KmlLayer object.
     * We export a kmz file from the external map and upload it to our site uploads folder.
     */
    function addKmlLayer() {
        kmlLayer = new google.maps.KmlLayer({
            url: `${schools_and_map_filter_ajax_obj.xmz_file}`
        });
        resetMap();
    }

    /**
     * Reset the map to the kmlLayer
     */
    function resetMap() {
        if (typeof kmlLayer !== 'undefined') {
            kmlLayer.setMap(map);
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
     * @returns array of cities that appear in the map
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
        /* Give the current item a class so we know if it's open or closed.
        * We give the class to the parent, elementor-accordion-item */
        // shut off the other cities
        let accordionItem = self.parents('.elementor-accordion-item');

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
                }
            );
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
                let isThereANewCity = false;
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
            }
        );
    }

    /**
     * This is the function that creates our own info window
     * @param event - has the featureData and latLng fields that are needed to create our window.
     */
    function openInfoWindow(event) {
        let infowindowTitle = "<h3 class='info_window_header'>" + event.featureData.name + "</h3>";
        let infowindowDescription = "<div class='info_window_content'>";
        infowindowDescription += getInfowindowFeaturedData(event.featureData.description);
        infowindowDescription += "</div>"; // + event.featureData.description +
        infowindow.setContent(infowindowTitle + infowindowDescription);
        infowindow.setPosition(event.latLng); // even though we set the pixelOffset in the constructor, we also have to set the position.
        /* this is the only way I found to hide the original infowindow because suppressInfoWindows doesn't work and neither does showInfoWindowOnClick.
        Got the idea from here: https://stackoverflow.com/a/22083454/278
        maybe try baloonstyle: https://stackoverflow.com/questions/32557103/kml-file-is-there-a-way-to-completely-disable-description-bubbles*/
        event.featureData.infoWindowHtml = "";
        infowindow.open(map);
    }

    /**
     * Get the description from the Google window and parse them to display in our window
     * @param description - has the address and the site url of this school
     * @returns string - the HTML of the parsed description
     */
    function getInfowindowFeaturedData(description) {
        let descriptionParts = description.split('<br>');
        let ret = "", schoolAddress, schoolUrl;
        if (descriptionParts.length === 4) {
            /* the string has 4 parts, where the first 2 are a lesser duplications of the 2 latter ones.
             * In the 2 latter ones:
             * descriptionParts[2] is the school address,
             * descriptionParts[3] is the school url
             * make the term title bold:
             * */
            schoolAddress = descriptionParts[2];
            schoolUrl = descriptionParts[3];
        } else if (descriptionParts.length) {
            /* Ths string only has the description. We'll work with that */
            schoolAddress = leaveOutUnnecessaryStuff(descriptionParts[0]);
            schoolUrl = descriptionParts[1];
        }

        /* Only if there is an actual address and not only the title, display it in HTML */
        if (schoolAddress.indexOf(":") < schoolAddress.length - 1) {
            schoolAddress = removeTrailingSlashFromURL(schoolAddress);
            ret += "<div>" + makeTitleBold(schoolAddress) + "</div>";
        }

        /* Only if there is an actual address and not only the title, display it in HTML */
        if (schoolUrl.indexOf(":") < schoolUrl.length - 1) {
            // remove trailing slash from site url
            schoolUrl = removeTrailingSlashFromURL(schoolUrl);

            ret += "<div>" + makeTitleBold(schoolUrl) + "</div>";
        }

        return ret;
    }

    /**
     *
     * @param firstPartOfDescription
     * @returns {*|string}
     */
    function leaveOutUnnecessaryStuff(firstPartOfDescription) {
        let ret = firstPartOfDescription;
        let semicolonPositions = indicesOfSemicolon(firstPartOfDescription);
        if (semicolonPositions.length > 1) {
            // return the string from after the one before last semicolon
            let startStrFrom = semicolonPositions[semicolonPositions.length - 2] + 1;
            ret = firstPartOfDescription.substring(startStrFrom).trim();
        }
        return ret;
    }

    /**
     * Removes the traling slash from the school URL
     * @param schoolUrl - the school URL
     * @returns the schoolUrl without trailing slash
     */
    function removeTrailingSlashFromURL(schoolUrl) {
        const trailingSlash = "/</a>";
        const withoutTrailingSlash = "</a>";
        return schoolUrl
            .replace(trailingSlash, withoutTrailingSlash)
            .replace("<a ", "<a class='info_window_school_link'");
    }

    /**
     * Finds all occurrences of a semicolon in a string.
     * Skips any semicolon that is part of a url
     * @param str - the string to look in
     * @returns {Array} - array of semicolon positions
     */
    function indicesOfSemicolon(str) {
        let regex = /:/gi, result, indices = [];
        while ((result = regex.exec(str))) {
            // make sure this isn't the semicolon from http://:
            if (str.substring(result.index - 5, result.index - 1) !== 'http') {
                indices.push(result.index);
            }
        }
        return indices;
    }

    /**
     *
     * @param str
     * @returns {string}
     */
    function makeTitleBold(str) {
        // the part from the beginning to the colon should be bold
        let indexOfColon = str.indexOf(":");
        str = "<span class='info_window_term'>" + str.substr(0, indexOfColon + 1) + "</span>" + str.substr(indexOfColon + 1);
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
        if (isElementInViewport(mapElement)) {
            // when map is in view, hide the map button
            linkToMap.hide();
            linkToList.show();
        } else {
            linkToMap.show();
            linkToList.hide();
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
        );
    }

    /* Watch accessibility css change of background color */
    bodyCssChange();

    /**
     * taken from here:
     * https://stackoverflow.com/a/20683311/278
     */
    function bodyCssChange() {
        // Select the node that will be observed for mutations
        var targetNode = document.getElementById('page');
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

        // Callback function to execute when mutations are observed
        var index = 0;
        var callback = function (mutationsList) {
            for (var mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    mapElement.css({
                        'background-color': 'transparent'
                    });
                    let currElements = mapElement.children();
                    while (currElements.length > 0) {
                        currElements.css({
                            'background-color': 'transparent'
                        });
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
});