/**
 * @license MIT
 * @author Michael Scharl <michael.scharl@me.com>
 */

"use strict";
/************************************************************************************************************/
/*                              Dependency injection and environment detection                              */
/************************************************************************************************************/

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

(function (componentFactory, componentName) {

    // CommonJS
    if ((typeof exports === "undefined" ? "undefined" : _typeof(exports)) === "object" && typeof module !== "undefined") {
        module.exports = componentFactory(require('react'));
    }
    // RequireJS
    else if (typeof define === "function" && define.amd) {
            define(['react'], componentFactory);
        }
        // <script>
        else {
                var g;

                if (typeof window !== "undefined") {
                    g = window;
                } else if (typeof global !== "undefined") {
                    g = global;
                } else if (typeof self !== "undefined") {
                    g = self;
                } else {
                    return console && console.error && console.error("Couldn't detect environment. Please file an Issue at %s with information about your runtime" + " environment.", "https://github.com/mscharl/react-fb-photoselector/issues");
                }

                g[componentName] = componentFactory(g.React);
            }
})(function (React) {
    var ERROR = {
        CONNECTION_FAILED: {
            code: -1,
            message: 'could not connect to fb'
        },
        NO_ALBUMS: {
            code: 1,
            message: 'could not load albums from user'
        },
        NO_PHOTOS: {
            code: 2,
            message: 'could not load photos from album'
        }
    };

    var MSFBPhotoSelector;
    return MSFBPhotoSelector = React.createClass({
        /************************************************************************************************************/
        /*                                         Core Component Functions                                         */
        /*                                                                                                          */
        /* For detailed information see {@link https://facebook.github.io/react/docs/component-specs.html}          */
        /************************************************************************************************************/

        /**
         * The displayName string is used in debugging messages
         */
        displayName: 'MSFBPhotoSelector',

        /**
         * The statics object allows you to define static methods that can be called on the component class
         */
        statics: {

            /**
             * All texts inside that photoselector
             */
            TEXTS: {
                your_albums: 'Your Albums',
                show_more: 'Show more',
                loading: 'Loading…',
                connection_failed: 'Failed to connect to Facebook.',
                could_not_load_albums: 'Albums couldn\'t be loaded.',
                could_not_load_album_photos: 'Data for this album could not be loaded.',
                could_not_select_photo: 'Failed to select the photo.',
                close: 'Close'
            },

            ERROR: ERROR,

            /**
             * Number of images to show on initialization
             */
            ALBUM_PHOTOS_LIMIT: 6,

            /**
             * Number of images to add when clicking on "show more"
             */
            ALBUM_PHOTOS_ROWS_TO_ADD: 3
        },

        /**
         * The propTypes object allows you to validate props being passed to your components. For more information about
         * propTypes, see {@link https://facebook.github.io/react/docs/reusable-components.html Reusable Components}.
         */
        propTypes: {
            closeOnEsc: React.PropTypes.bool,
            closeOnOutsideClick: React.PropTypes.bool,

            onError: React.PropTypes.func,
            onCancel: React.PropTypes.func.isRequired,
            onSelect: React.PropTypes.func.isRequired
        },

        /**
         * Invoked once before the component is mounted.
         * The return value will be used as the initial value of `this.state`.
         */
        getInitialState: function getInitialState() {
            return {
                FB_user_picture_url: '',
                FB_albums: [],
                FB_accessToken: '',

                initializing: true,

                selectedPhoto: 0,
                selectingPhoto: false,

                showErrorMessage: false,
                errorMessageLink: '',
                errorMessage: '',

                inComponentClick: false
            };
        },


        /**
         * Invoked once and cached when the class is created.
         * Values in the mapping will be set on this.props if that prop is not specified by the parent component.
         * {@link https://facebook.github.io/react/docs/component-specs.html#getdefaultprops}
         *
         * @return {{}}
         */
        getDefaultProps: function getDefaultProps() {
            return {
                closeOnEsc: true,
                closeOnOutsideClick: true,

                onError: function onError() {
                    return null;
                }
            };
        },


        /**
         * Invoked once, only on the client (not on the server), immediately
         * after the initial rendering occurs. At this point in the lifecycle,
         * you can access any refs to your children (e.g., to access the
         * underlying DOM representation). The componentDidMount() method of
         * child components is invoked before that of parent components.
         */
        componentDidMount: function componentDidMount() {
            var _this = this;

            _this._manageGlobalEventHandlers(_this.props);

            _this._FB_init(function () {
                _this.setState({
                    initializing: false
                });
            });
        },


        /**
         * Invoked immediately before a component is unmounted from the DOM.
         *
         * Perform any necessary cleanup in this method,
         * such as invalidating timers or cleaning up any DOM elements that
         * were created in componentDidMount.
         */
        componentWillUnmount: function componentWillUnmount() {
            this._manageGlobalEventHandlers({}, true);
        },
        componentWillReceiveProps: function componentWillReceiveProps(nextProps) {
            this._manageGlobalEventHandlers(nextProps);
        },


        /************************************************************************************************************/
        /*                                        Component Functions                                               */
        /************************************************************************************************************/

        /**
         * Add or forceRemove event listeners depending on the given props
         *
         * @param props
         * @param forceRemove
         * @private
         */
        _manageGlobalEventHandlers: function _manageGlobalEventHandlers(props, forceRemove) {
            var _this = this;

            if (!forceRemove && props.closeOnEsc) {
                document.addEventListener('keyup', _this.onKeyup_document);
            } else {
                document.removeEventListener('keyup', _this.onKeyup_document);
            }

            if (!forceRemove && props.closeOnOutsideClick) {
                document.addEventListener('click', _this.onClick_document);
            } else {
                document.removeEventListener('click', _this.onClick_document);
            }
        },


        /************************************************************************************************************/
        /*                                        FB-Communication Functions                                        */
        /************************************************************************************************************/

        /**
         * Function to initialize the components FB-Connection
         * @private
         */
        _FB_init: function _FB_init(finishedCallback) {
            var _this = this;

            //Fail if FB is not available
            if (typeof FB === 'undefined') {
                throw new Error('FB-SDK was not found!');
            }

            //Get the users AccessToken
            FB.getLoginStatus(function (response) {
                //Fail if not connected
                if (response.status != 'connected') {
                    _this.props.onError(ERROR.CONNECTION_FAILED);
                    _this.set_errorMessage(MSFBPhotoSelector.TEXTS.connection_failed);
                }

                //Load data when connected
                else {
                        _this.setState({
                            FB_accessToken: response.authResponse.accessToken
                        });

                        _this._FB_getUserAlbums(finishedCallback);
                        _this._FB_getUserImage();
                    }
            }, true);
        },


        /**
         * Load the user image
         * @private
         */
        _FB_getUserImage: function _FB_getUserImage() {
            var _this = this;

            _this._FB_API('/me/picture', function (response) {
                _this.setState({
                    FB_user_picture: response.data.url
                });
            });
        },


        /**
         * Get all albums from the logged in user
         *
         * @param finishedCallback
         * @private
         */
        _FB_getUserAlbums: function _FB_getUserAlbums(finishedCallback) {
            var _this = this;

            _this._FB_API('/me/albums', { fields: 'name,id' }, function (response) {
                if (!response || response.error) {
                    _this.props.onError(ERROR.NO_ALBUMS);
                    _this.set_errorMessage(MSFBPhotoSelector.TEXTS.could_not_load_albums);
                } else {
                    _this.setState({
                        FB_albums: response.data.map(function (album) {
                            var album = {
                                id: album.id,
                                name: album.name,
                                loading: false,
                                limit: MSFBPhotoSelector.ALBUM_PHOTOS_LIMIT,
                                photos: []
                            };

                            _this._FB_getAlbumPhotos(album);

                            return album;
                        })
                    }, finishedCallback);
                }
            });
        },


        /**
         * Get photos from a given album
         *
         * @param album
         * @private
         */
        _FB_getAlbumPhotos: function _FB_getAlbumPhotos(album) {
            var _this = this;

            _this._FB_API("/" + album.id + "/photos", { fields: 'id', limit: 999999 }, function (response) {
                if (!response || response.error) {
                    _this.props.onError(ERROR.NO_PHOTOS);
                    _this.set_errorMessage(MSFBPhotoSelector.TEXTS.could_not_load_album_photos, 'https://facebook.com/' + album.id);
                } else {
                    var index = _this.state.FB_albums.indexOf(album);
                    var FB_albums = _this.state.FB_albums.slice(0);

                    FB_albums[index].photos = response.data.map(function (photo) {
                        return { id: photo.id };
                    });
                    _this.setState({ FB_albums: FB_albums });
                }
            });
        },


        /**
         * Get the data for a given photo by id
         *
         * @param photoId
         * @param callback
         * @private
         */
        _FB_getPhoto: function _FB_getPhoto(photoId, callback) {
            var _this = this;

            _this._FB_API('/' + photoId + '/picture', callback);
        },


        /**
         * Wrapper for the FB.api function to avoid unwanted errors
         *
         * @param p1
         * @param p2
         * @param p3
         * @private
         */
        _FB_API: function _FB_API(p1, p2, p3) {
            if (typeof FB === 'undefined') {
                throw new Error('FB-SDK was not found!');
            }

            FB.api(p1, p2, p3);
        },


        /************************************************************************************************************/
        /*                                         Event Handling Functions                                         */
        /************************************************************************************************************/

        /**
         * Handle keyup event onto document
         * Close component when `ESC` was pressed
         *
         * @param event
         */
        onKeyup_document: function onKeyup_document(event) {
            if (event.keyCode == 27) {
                this.onClick_cancel();
            }
        },


        /**
         * Handle click onto document
         * Close Component if default is not prevented
         *
         * @param event
         */
        onClick_document: function onClick_document(event) {
            if (event.defaultPrevented || this.state.inComponentClick) {
                this.setState({
                    inComponentClick: false
                });
                return;
            }

            this.onClick_cancel();
        },


        /**
         * Handle when the user clicks "close"
         */
        onClick_cancel: function onClick_cancel() {
            this.props.onCancel();
        },


        /**
         * Handle when the user selects an image
         *
         * @param photo
         */
        onClick_photo: function onClick_photo(photo) {
            var _this = this;

            //Set the state to selecting
            _this.setState({
                selectedPhoto: photo.id,
                selectingPhoto: true
            },
            //After setting the state load the photo data
            function () {
                return _this._FB_getPhoto(photo.id, function (response) {
                    _this.props.onSelect({
                        id: photo.id,
                        url: response.data.url
                    });
                });
            });
        },


        /**
         * Handle when the user wants to see more photos of an album
         *
         * @param album
         */
        onClick_showMorePhotos: function onClick_showMorePhotos(album) {
            var _this = this,
                FB_albums = _this.state.FB_albums.slice(),
                index = FB_albums.indexOf(album);

            //Increase the limit
            FB_albums[index].limit += MSFBPhotoSelector.ALBUM_PHOTOS_LIMIT * MSFBPhotoSelector.ALBUM_PHOTOS_ROWS_TO_ADD;

            _this.setState({
                FB_albums: FB_albums,
                inComponentClick: true
            });
        },


        /**
         * Display an error message
         *
         * @param errorMessage
         * @param [errorMessageLink]
         * @param [timeToShow]
         */
        set_errorMessage: function set_errorMessage(errorMessage, errorMessageLink, timeToShow) {
            var _this = this;

            _this.setState({
                showErrorMessage: typeof link === 'undefined' ? 1 : 2,
                errorMessage: errorMessage,
                errorMessageLink: errorMessageLink
            }, function () {
                return setTimeout(function () {
                    return _this.setState({
                        showErrorMessage: false,
                        errorMessage: '',
                        errorMessageLink: ''
                    });
                }, timeToShow || 4000);
            });
        },


        /************************************************************************************************************/
        /*                                        Render this awesome stuff                                         */
        /************************************************************************************************************/
        render: function render() {
            return this.renderPart_popup();
        },
        renderPart_popup: function renderPart_popup() {
            var _this = this;

            return React.createElement(
                "div",
                { className: "ms-fbphotoselector__popup" },
                React.createElement(
                    "div",
                    { className: "ms-fbphotoselector" },
                    _this.renderPart_header(),
                    React.createElement(
                        "div",
                        { className: "ms-fbphotoselector__content" },
                        _this.renderPart_error(),
                        _this.state.initializing ? _this.renderPath_loading() : _this.renderPart_albums()
                    ),
                    _this.renderPart_footer(),
                    _this.state.selectingPhoto ? React.createElement("div", { className: "ms-fbphotoselector__content__overlay" }) : null
                )
            );
        },
        renderPart_header: function renderPart_header() {
            var _this = this;

            return React.createElement(
                "div",
                { className: "ms-fbphotoselector__header" },
                !!_this.state.FB_user_picture_url ? React.createElement("img", { src: _this.state.user_picture,
                    className: "ms-fbphotoselector__header__user-image" }) : null,
                React.createElement("i", { className: "ms-fbphotoselector__header__icon" }),
                MSFBPhotoSelector.TEXTS.your_albums
            );
        },
        renderPart_footer: function renderPart_footer() {
            var _this = this;

            return React.createElement(
                "div",
                { className: "ms-fbphotoselector__footer" },
                React.createElement(
                    "a",
                    { onClick: _this.onClick_cancel },
                    MSFBPhotoSelector.TEXTS.close
                )
            );
        },
        renderPath_loading: function renderPath_loading() {
            return React.createElement(
                "div",
                { className: "ms-fbphotoselector__loader" },
                MSFBPhotoSelector.TEXTS.loading
            );
        },
        renderPart_albums: function renderPart_albums() {
            var _this = this,
                albums = _this.state.FB_albums.filter(function (album) {
                return !!album.photos.length;
            });

            return React.createElement(
                "ul",
                { className: "ms-fbphotoselector__albums" },
                albums.map(function (album) {
                    return React.createElement(
                        "li",
                        { key: album.id, className: "ms-fbphotoselector__albums__item" },
                        React.createElement(
                            "h3",
                            { className: "ms-fbphotoselector__albums__item-name" },
                            album.name
                        ),
                        React.createElement(
                            "ul",
                            { className: "ms-fbphotoselector__albums__photos" },
                            album.photos.slice(0, album.limit).map(_this.renderPart_photo)
                        ),
                        album.limit < album.photos.length ? React.createElement(
                            "button",
                            { className: "ms-fbphotoselector__albums__item-more",
                                onClick: function onClick() {
                                    return _this.onClick_showMorePhotos(album);
                                } },
                            MSFBPhotoSelector.TEXTS.show_more
                        ) : null
                    );
                })
            );
        },
        renderPart_photo: function renderPart_photo(photo) {
            var _this = this;
            var styles = {
                backgroundImage: "url('https://graph.facebook.com/" + photo.id + "/picture?type=album&access_token=" + _this.state.FB_accessToken + "')"
            },
                classes = ["ms-fbphotoselector__albums__photos-image__image", _this.state.selectedPhoto == photo.id && "ms-fbphotoselector__albums__photos-image__image--selected"];

            return React.createElement(
                "li",
                { key: photo.id, className: "ms-fbphotoselector__albums__photos-image" },
                React.createElement("div", { className: classes.join(' '), onClick: function onClick() {
                        return _this.onClick_photo(photo);
                    }, style: styles })
            );
        },
        renderPart_error: function renderPart_error() {
            var _this = this;

            var classes = ["ms-fbphotoselector__error", _this.state.showErrorMessage && "ms-fbphotoselector__error--visible"];

            return _this.state.showErrorMessage ? React.createElement(
                "div",
                { className: classes.join(' ') },
                React.createElement("span", { className: "ms-fbphotoselector__error__icon" }),
                _this.state.showErrorMessage != 2 ? React.createElement(
                    "span",
                    { className: "ms-fbphotoselector__error__text" },
                    _this.state.errorMessage
                ) : React.createElement(
                    "a",
                    { href: _this.state.errorMessageLink, target: "_blank",
                        className: "ms-fbphotoselector__error__text" },
                    _this.state.errorMessage
                )
            ) : null;
        }
    });
}, 'MSFBPhotoSelector');